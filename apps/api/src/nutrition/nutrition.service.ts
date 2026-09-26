import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { assertBarnAccess } from '../common/barn-scope';
import { loadUserNames, userLabel } from '../common/user-names';
import { OperationRecordStatus } from '../generated/tenant-client';
import { ConsumptionStockSyncService } from '../operation/consumption-stock-sync.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { UpsertFeedDto } from './dto/upsert-feed.dto';

@Injectable()
export class NutritionService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stockSync: ConsumptionStockSyncService,
  ) {}

  private hasPermission(user: JwtPayload, code: string) {
    return user.permissions.includes('*') || user.permissions.includes(code);
  }

  async upsertFeed(user: JwtPayload, dto: UpsertFeedDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);
    const date = new Date(dto.date);

    const before = await prisma.dailyFeedConsumption.findUnique({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
    });
    const locked =
      before &&
      (before.status === OperationRecordStatus.REVIEWED || before.status === OperationRecordStatus.ADJUSTED);
    if (locked) {
      if (!this.hasPermission(user, 'production.adjust')) {
        throw new ForbiddenException('Registro já conferido: alteração exige permissão de ajuste autorizado.');
      }
      if (!dto.reason?.trim()) {
        throw new BadRequestException('Informe a justificativa para alterar um registro conferido.');
      }
    }

    // Troca de produto/local com baixa já feita: reverte antes de gravar o novo vínculo.
    if (
      before &&
      ((dto.productId !== undefined && (dto.productId || null) !== before.productId) ||
        (dto.stockLocationId !== undefined && (dto.stockLocationId || null) !== before.stockLocationId))
    ) {
      await this.stockSync.unsyncFeed(user.tenantSlug, before.id);
    }

    const row = await prisma.dailyFeedConsumption.upsert({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
      create: {
        flockLotId: dto.flockLotId,
        date,
        consumedKg: dto.consumedKg,
        leftoverKg: dto.leftoverKg ?? 0,
        productId: dto.productId || undefined,
        stockLocationId: dto.stockLocationId || undefined,
        shift: dto.shift?.trim() || undefined,
        createdByUserId: user.sub,
        status: OperationRecordStatus.RECORDED,
      },
      update: {
        consumedKg: dto.consumedKg,
        leftoverKg: dto.leftoverKg ?? 0,
        ...(dto.productId !== undefined ? { productId: dto.productId || null } : {}),
        ...(dto.stockLocationId !== undefined ? { stockLocationId: dto.stockLocationId || null } : {}),
        shift: dto.shift?.trim() || null,
        ...(before && before.status === OperationRecordStatus.REVIEWED
          ? { status: OperationRecordStatus.ADJUSTED }
          : {}),
      },
    });

    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: before ? 'UPDATE' : 'CREATE',
      entity: 'DailyFeedConsumption',
      entityId: row.id,
      before: before ?? undefined,
      after: row,
      reason: dto.reason,
    });

    // baixa no estoque conforme modo configurado (no registro / após conferência)
    await this.stockSync.syncFeed(user.tenantSlug, row.id);

    return row;
  }

  async transferFeed(
    user: JwtPayload,
    data: { fromLotId: string; toLotId: string; date: string; quantityKg: number; notes?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = await prisma.flockLot.findUnique({ where: { id: data.fromLotId } });
    const to = await prisma.flockLot.findUnique({ where: { id: data.toLotId } });
    if (!from || !to) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, from.barnId);
    assertBarnAccess(user, to.barnId);
    return prisma.feedTransfer.create({
      data: {
        fromLotId: data.fromLotId,
        toLotId: data.toLotId,
        date: new Date(data.date),
        quantityKg: data.quantityKg,
        notes: data.notes,
      },
    });
  }

  async listDailyFeed(user: JwtPayload, flockLotId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.dailyFeedConsumption.findMany({
      where: {
        ...(flockLotId ? { flockLotId } : {}),
        ...(user.barnIds.length ? { flockLot: { barnId: { in: user.barnIds } } } : {}),
      },
      orderBy: { date: 'desc' },
      take: 500,
      include: {
        flockLot: { select: { code: true, barnId: true } },
        product: { select: { id: true, sku: true, name: true } },
      },
    });
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

  async listFeedTransfers(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.feedTransfer.findMany({
      orderBy: { date: 'desc' },
      take: 500,
      include: {
        fromLot: { select: { code: true } },
        toLot: { select: { code: true } },
      },
    });
  }
}
