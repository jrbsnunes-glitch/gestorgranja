import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess, filterLotsByBarnScope } from '../common/barn-scope';
import { loadUserNames, userLabel } from '../common/user-names';
import { AuditService } from '../audit/audit.service';
import { FlockLotStatus, FlockMovementType, OperationRecordStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EggProductionStockService } from './egg-production-stock.service';
import { computeFlockBalance } from './flock-balance.util';
import { CreateFlockMovementDto } from './dto/create-flock-movement.dto';
import { UpsertDailyEggDto } from './dto/upsert-daily-egg.dto';
import { UpsertDailyMortalityDto } from './dto/upsert-daily-mortality.dto';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly eggStock: EggProductionStockService,
  ) {}

  private hasPermission(user: JwtPayload, code: string) {
    return user.permissions.includes('*') || user.permissions.includes(code);
  }

  /** Alterar registro já conferido exige `production.adjust` e justificativa. */
  private assertCanModify(
    user: JwtPayload,
    existing: { status: OperationRecordStatus } | null,
    reason?: string,
  ) {
    if (!existing) return;
    const locked =
      existing.status === OperationRecordStatus.REVIEWED || existing.status === OperationRecordStatus.ADJUSTED;
    if (!locked) return;
    if (!this.hasPermission(user, 'production.adjust')) {
      throw new ForbiddenException('Registro já conferido: alteração exige permissão de ajuste autorizado.');
    }
    if (!reason?.trim()) {
      throw new BadRequestException('Informe a justificativa para alterar um registro conferido.');
    }
  }

  async listLots(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lots = await prisma.flockLot.findMany({
      include: {
        barn: true,
        breedLineage: true,
        mortalities: { select: { quantity: true } },
        movements: { select: { type: true, quantity: true } },
      },
      orderBy: { housingDate: 'desc' },
    });
    const scoped = await filterLotsByBarnScope(user, lots);
    return scoped.map(({ mortalities, movements, ...lot }) => {
      const mortalityTotal = mortalities.reduce((s, m) => s + m.quantity, 0);
      const balance = computeFlockBalance(lot.housedQty, movements, mortalityTotal);
      return { ...lot, mortalityTotal, liveBirds: balance.liveBirds, balance };
    });
  }

  /** Composição do saldo de aves de um lote (origem do cálculo). */
  async lotBalance(user: JwtPayload, flockLotId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({
      where: { id: flockLotId },
      include: {
        mortalities: { select: { quantity: true } },
        movements: { select: { type: true, quantity: true } },
      },
    });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);
    const mortalityTotal = lot.mortalities.reduce((s, m) => s + m.quantity, 0);
    return computeFlockBalance(lot.housedQty, lot.movements, mortalityTotal);
  }

  async listFlockMovements(user: JwtPayload, flockLotId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);
    const rows = await prisma.flockMovement.findMany({
      where: { flockLotId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });
    const names = await loadUserNames(prisma, rows.map((r) => r.createdByUserId));
    const counterpartIds = [...new Set(rows.map((r) => r.counterpartLotId).filter((v): v is string => !!v))];
    const counterparts = counterpartIds.length
      ? await prisma.flockLot.findMany({ where: { id: { in: counterpartIds } }, select: { id: true, code: true } })
      : [];
    const cpMap = new Map(counterparts.map((c) => [c.id, c.code]));
    return rows.map((r) => ({
      ...r,
      createdByName: userLabel(names, r.createdByUserId),
      counterpartLotCode: r.counterpartLotId ? cpMap.get(r.counterpartLotId) ?? null : null,
    }));
  }

  /**
   * Registra movimentação de aves. Transferências criam a contrapartida no lote destino/origem.
   * ADJUST e CLOSE exigem `production.adjust` e justificativa; CLOSE encerra o lote.
   */
  async createFlockMovement(user: JwtPayload, flockLotId: string, dto: CreateFlockMovementDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const needsAdjustPermission = dto.type === FlockMovementType.ADJUST || dto.type === FlockMovementType.CLOSE;
    if (needsAdjustPermission) {
      if (!this.hasPermission(user, 'production.adjust')) {
        throw new ForbiddenException('Ajuste/encerramento de lote exige permissão de ajuste autorizado.');
      }
      if (!dto.reason?.trim()) {
        throw new BadRequestException('Informe a justificativa do ajuste/encerramento.');
      }
    }
    if (dto.type !== FlockMovementType.CLOSE && dto.type !== FlockMovementType.ADJUST && dto.quantity <= 0) {
      throw new BadRequestException('Quantidade deve ser maior que zero.');
    }
    if (dto.type === FlockMovementType.ADJUST && dto.quantity === 0) {
      throw new BadRequestException('Ajuste com quantidade zero não altera o saldo.');
    }
    if (lot.status === FlockLotStatus.FINISHED && dto.type !== FlockMovementType.ADJUST) {
      throw new BadRequestException('Lote encerrado: somente ajuste autorizado é permitido.');
    }

    const isTransfer = dto.type === FlockMovementType.TRANSFER_IN || dto.type === FlockMovementType.TRANSFER_OUT;
    let counterpart: { id: string; barnId: string; status: FlockLotStatus } | null = null;
    if (isTransfer) {
      if (!dto.counterpartLotId) throw new BadRequestException('Informe o lote de contrapartida da transferência.');
      if (dto.counterpartLotId === flockLotId) throw new BadRequestException('Lote de contrapartida deve ser diferente.');
      counterpart = await prisma.flockLot.findUnique({
        where: { id: dto.counterpartLotId },
        select: { id: true, barnId: true, status: true },
      });
      if (!counterpart) throw new NotFoundException('Lote de contrapartida não encontrado');
      assertBarnAccess(user, counterpart.barnId);
      if (counterpart.status === FlockLotStatus.FINISHED) {
        throw new BadRequestException('Lote de contrapartida está encerrado.');
      }
    }

    const date = new Date(dto.date);
    const qty = dto.type === FlockMovementType.CLOSE ? 0 : dto.quantity;

    const created = await prisma.$transaction(async (tx) => {
      const row = await tx.flockMovement.create({
        data: {
          flockLotId,
          date,
          type: dto.type,
          quantity: qty,
          counterpartLotId: dto.counterpartLotId,
          reason: dto.reason?.trim() || undefined,
          createdByUserId: user.sub,
        },
      });
      if (isTransfer && counterpart) {
        await tx.flockMovement.create({
          data: {
            flockLotId: counterpart.id,
            date,
            type:
              dto.type === FlockMovementType.TRANSFER_OUT ? FlockMovementType.TRANSFER_IN : FlockMovementType.TRANSFER_OUT,
            quantity: Math.abs(qty),
            counterpartLotId: flockLotId,
            reason: dto.reason?.trim() || undefined,
            createdByUserId: user.sub,
          },
        });
      }
      if (dto.type === FlockMovementType.CLOSE) {
        await tx.flockLot.update({
          where: { id: flockLotId },
          data: { status: FlockLotStatus.FINISHED, finishedAt: new Date() },
        });
      }
      return row;
    });

    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'CREATE',
      entity: 'FlockMovement',
      entityId: created.id,
      after: created,
      reason: dto.reason,
    });

    return created;
  }

  async upsertDailyEgg(user: JwtPayload, dto: UpsertDailyEggDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const date = new Date(dto.date);
    const before = await prisma.dailyEggProduction.findUnique({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
    });
    this.assertCanModify(user, before, dto.reason);

    const values = {
      extra: dto.extra,
      large: dto.large,
      medium: dto.medium,
      small: dto.small,
      cracked: dto.cracked,
      dirty: dto.dirty,
      deformed: dto.deformed,
      discard: dto.discard,
      avgEggWeightG: dto.avgEggWeightG,
      notes: dto.notes,
      discardReason: dto.discardReason?.trim() || null,
      shift: dto.shift?.trim() || null,
    };

    const row = await prisma.dailyEggProduction.upsert({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
      create: {
        flockLotId: dto.flockLotId,
        date,
        ...values,
        createdByUserId: user.sub,
        status: OperationRecordStatus.RECORDED,
      },
      update: {
        ...values,
        // registro conferido que foi alterado passa a "ajustado"
        ...(before && before.status === OperationRecordStatus.REVIEWED
          ? { status: OperationRecordStatus.ADJUSTED }
          : {}),
      },
    });

    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: before ? 'UPDATE' : 'CREATE',
      entity: 'DailyEggProduction',
      entityId: row.id,
      before: before ?? undefined,
      after: row,
      reason: dto.reason,
    });

    // Estoque de ovos: imediato, ou só após conferência (OperationSettings.eggSyncOnlyReviewed).
    const opSettings = await prisma.operationSettings.findUnique({ where: { id: 'default' } });
    const syncNow =
      !opSettings?.eggSyncOnlyReviewed ||
      row.status === OperationRecordStatus.REVIEWED ||
      row.status === OperationRecordStatus.ADJUSTED;
    if (syncNow) {
      void this.eggStock.syncFromProduction(user, row).catch((e) => {
        // não bloqueia postura se estoque não estiver configurado
        this.logger.warn(`Egg stock sync: ${(e as Error).message}`);
      });
    }

    return { row, before };
  }

  async createEnvironmentalReading(
    user: JwtPayload,
    data: { barnId: string; temperatureC?: number; humidityPct?: number; ventilationNote?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    assertBarnAccess(user, data.barnId);
    return prisma.environmentalReading.create({
      data: {
        barnId: data.barnId,
        recordedAt: new Date(),
        temperatureC: data.temperatureC,
        humidityPct: data.humidityPct,
        ventilationNote: data.ventilationNote,
        source: 'MANUAL',
      },
    });
  }

  async createDailyMortality(user: JwtPayload, dto: UpsertDailyMortalityDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const date = new Date(dto.date);
    return prisma.dailyMortality.create({
      data: {
        flockLotId: dto.flockLotId,
        date,
        quantity: dto.quantity,
        cause: dto.cause,
        causeNotes: dto.causeNotes,
        shift: dto.shift?.trim() || undefined,
        createdByUserId: user.sub,
      },
    });
  }

  async updateDailyMortality(user: JwtPayload, id: string, dto: UpsertDailyMortalityDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.dailyMortality.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Registro não encontrado');

    const lot = await prisma.flockLot.findUnique({ where: { id: row.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    if (dto.flockLotId !== row.flockLotId) {
      const target = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
      if (!target) throw new NotFoundException('Lote não encontrado');
      assertBarnAccess(user, target.barnId);
    }
    this.assertCanModify(user, row, dto.reason);

    const date = new Date(dto.date);
    const updated = await prisma.dailyMortality.update({
      where: { id },
      data: {
        flockLotId: dto.flockLotId,
        date,
        quantity: dto.quantity,
        cause: dto.cause,
        causeNotes: dto.causeNotes,
        shift: dto.shift?.trim() || null,
        ...(row.status === OperationRecordStatus.REVIEWED ? { status: OperationRecordStatus.ADJUSTED } : {}),
      },
    });

    if (dto.reason?.trim()) {
      void this.audit.log({
        tenantSlug: user.tenantSlug,
        userId: user.sub,
        action: 'UPDATE',
        entity: 'DailyMortality',
        entityId: id,
        before: row,
        after: updated,
        reason: dto.reason,
      });
    }
    return updated;
  }

  /** Sincronização do campo: um registro por lote/dia (atualiza o mais recente se existir). */
  async upsertDailyMortality(user: JwtPayload, dto: UpsertDailyMortalityDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const date = new Date(dto.date);
    const existing = await prisma.dailyMortality.findFirst({
      where: { flockLotId: dto.flockLotId, date },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      this.assertCanModify(user, existing, dto.reason);
      return prisma.dailyMortality.update({
        where: { id: existing.id },
        data: {
          quantity: dto.quantity,
          cause: dto.cause,
          causeNotes: dto.causeNotes,
        },
      });
    }

    return prisma.dailyMortality.create({
      data: {
        flockLotId: dto.flockLotId,
        date,
        quantity: dto.quantity,
        cause: dto.cause,
        causeNotes: dto.causeNotes,
        createdByUserId: user.sub,
      },
    });
  }

  commercialEggs(row: {
    extra: number;
    large: number;
    medium: number;
    small: number;
  }) {
    return row.extra + row.large + row.medium + row.small;
  }

  private async withUserNames<T extends { createdByUserId: string | null; reviewedByUserId: string | null }>(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    rows: T[],
  ) {
    const names = await loadUserNames(prisma, [
      ...rows.map((r) => r.createdByUserId),
      ...rows.map((r) => r.reviewedByUserId),
    ]);
    return rows.map((r) => ({
      ...r,
      createdByName: userLabel(names, r.createdByUserId),
      reviewedByName: userLabel(names, r.reviewedByUserId),
    }));
  }

  async listDailyEggs(user: JwtPayload, flockLotId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lots = await this.listLots(user);
    const lotIds = flockLotId ? [flockLotId] : lots.map((l) => l.id);
    const rows = await prisma.dailyEggProduction.findMany({
      where: { flockLotId: { in: lotIds } },
      orderBy: { date: 'desc' },
      take: 500,
      include: { flockLot: { select: { code: true, barnId: true } } },
    });
    return this.withUserNames(prisma, rows);
  }

  async listDailyMortality(user: JwtPayload, flockLotId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lots = await this.listLots(user);
    const lotIds = flockLotId ? [flockLotId] : lots.map((l) => l.id);
    const rows = await prisma.dailyMortality.findMany({
      where: { flockLotId: { in: lotIds } },
      orderBy: { date: 'desc' },
      take: 500,
      include: { flockLot: { select: { code: true, barnId: true } } },
    });
    return this.withUserNames(prisma, rows);
  }

  async listEnvironmental(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.environmentalReading.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 500,
      include: { barn: { select: { code: true, name: true } } },
    });
  }

  /** Histórico de alterações (auditoria) de um registro operacional. */
  async recordHistory(user: JwtPayload, entity: string, id: string) {
    const allowed = new Set([
      'DailyEggProduction',
      'DailyMortality',
      'DailyFeedConsumption',
      'FlockMovement',
      'SupplyConsumption',
      'OperationalLoss',
      'OperationalOccurrence',
    ]);
    if (!allowed.has(entity)) throw new BadRequestException('Entidade não suportada para histórico.');
    return this.audit.historyFor(user.tenantSlug, entity, id);
  }
}
