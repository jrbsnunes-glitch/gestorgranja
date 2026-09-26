import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess } from '../common/barn-scope';
import { loadUserNames, userLabel } from '../common/user-names';
import { OccurrenceStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  CreateMaintenanceFromOccurrenceDto,
  CreateOccurrenceDto,
  UpdateOccurrenceDto,
} from './dto/occurrence.dto';

const OCCURRENCE_INCLUDE = {
  barn: { select: { id: true, code: true, name: true } },
  flockLot: { select: { id: true, code: true } },
  asset: { select: { id: true, code: true, name: true } },
  maintenanceRecord: { select: { id: true, performedAt: true, kind: true, cost: true } },
} as const;

@Injectable()
export class OccurrencesService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  private async decorate(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    rows: Array<{ createdByUserId: string | null; resolverUserId: string | null }>,
  ) {
    const names = await loadUserNames(prisma, [
      ...rows.map((r) => r.createdByUserId),
      ...rows.map((r) => r.resolverUserId),
    ]);
    return rows.map((r) => ({
      ...r,
      createdByName: userLabel(names, r.createdByUserId),
      resolverName: userLabel(names, r.resolverUserId),
    }));
  }

  async list(user: JwtPayload, filters: { status?: string; barnId?: string; flockLotId?: string; from?: string; to?: string }) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const statusList = filters.status
      ? (filters.status.split(',').filter((s) => s in OccurrenceStatus) as OccurrenceStatus[])
      : undefined;
    const rows = await prisma.operationalOccurrence.findMany({
      where: {
        ...(statusList?.length ? { status: { in: statusList } } : {}),
        ...(filters.barnId ? { barnId: filters.barnId } : {}),
        ...(filters.flockLotId ? { flockLotId: filters.flockLotId } : {}),
        ...(filters.from || filters.to
          ? {
              occurredAt: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(`${filters.to.slice(0, 10)}T23:59:59.999`) } : {}),
              },
            }
          : {}),
        ...(user.barnIds.length ? { OR: [{ barnId: { in: user.barnIds } }, { barnId: null }] } : {}),
      },
      include: OCCURRENCE_INCLUDE,
      orderBy: [{ status: 'asc' }, { priority: 'desc' }, { occurredAt: 'desc' }],
      take: 500,
    });
    return this.decorate(prisma, rows);
  }

  async create(user: JwtPayload, dto: CreateOccurrenceDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    let barnId = dto.barnId;
    if (dto.flockLotId) {
      const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
      if (!lot) throw new NotFoundException('Lote não encontrado');
      barnId = barnId ?? lot.barnId;
    }
    if (barnId) assertBarnAccess(user, barnId);

    const row = await prisma.operationalOccurrence.create({
      data: {
        occurredAt: new Date(dto.occurredAt),
        barnId,
        flockLotId: dto.flockLotId,
        type: dto.type,
        location: dto.location?.trim() || undefined,
        description: dto.description.trim(),
        priority: dto.priority,
        assetId: dto.assetId,
        createdByUserId: user.sub,
      },
      include: OCCURRENCE_INCLUDE,
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'CREATE',
      entity: 'OperationalOccurrence',
      entityId: row.id,
      after: row,
    });
    return row;
  }

  async update(user: JwtPayload, id: string, dto: UpdateOccurrenceDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const before = await prisma.operationalOccurrence.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Ocorrência não encontrada');
    if (before.barnId) assertBarnAccess(user, before.barnId);

    const closing =
      dto.status &&
      dto.status !== before.status &&
      (dto.status === OccurrenceStatus.RESOLVED || dto.status === OccurrenceStatus.CANCELLED);
    if (dto.status === OccurrenceStatus.RESOLVED && !(dto.actionTaken ?? before.actionTaken)?.trim()) {
      throw new BadRequestException('Informe a ação tomada para encerrar a ocorrência.');
    }

    const row = await prisma.operationalOccurrence.update({
      where: { id },
      data: {
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,
        barnId: dto.barnId === undefined ? undefined : dto.barnId || null,
        flockLotId: dto.flockLotId === undefined ? undefined : dto.flockLotId || null,
        type: dto.type,
        location: dto.location === undefined ? undefined : dto.location?.trim() || null,
        description: dto.description?.trim(),
        priority: dto.priority,
        status: dto.status,
        actionTaken: dto.actionTaken === undefined ? undefined : dto.actionTaken?.trim() || null,
        assetId: dto.assetId === undefined ? undefined : dto.assetId || null,
        ...(closing ? { resolverUserId: user.sub, resolvedAt: new Date() } : {}),
        ...(dto.status && dto.status !== before.status && !closing ? { resolverUserId: null, resolvedAt: null } : {}),
      },
      include: OCCURRENCE_INCLUDE,
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'UPDATE',
      entity: 'OperationalOccurrence',
      entityId: id,
      before,
      after: row,
    });
    if (closing) {
      // encerra alertas "ocorrência sem tratamento" vinculados
      await prisma.alert.updateMany({
        where: { type: 'OPEN_OCCURRENCE', referenceId: id, status: { in: ['OPEN', 'ACKNOWLEDGED'] } },
        data: { status: 'RESOLVED', resolvedAt: new Date() },
      });
    }
    return row;
  }

  /** Abre um registro de manutenção no patrimônio a partir da ocorrência e vincula os dois. */
  async createMaintenance(user: JwtPayload, id: string, dto: CreateMaintenanceFromOccurrenceDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const occ = await prisma.operationalOccurrence.findUnique({ where: { id } });
    if (!occ) throw new NotFoundException('Ocorrência não encontrada');
    if (occ.maintenanceRecordId) {
      throw new BadRequestException('Esta ocorrência já possui manutenção vinculada.');
    }
    const assetId = dto.assetId ?? occ.assetId;
    if (!assetId) throw new BadRequestException('Informe o equipamento (patrimônio) para abrir a manutenção.');
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Equipamento não encontrado');

    const record = await prisma.$transaction(async (tx) => {
      const m = await tx.maintenanceRecord.create({
        data: {
          assetId,
          performedAt: dto.performedAt ? new Date(dto.performedAt) : new Date(),
          kind: dto.kind?.trim() || 'CORRETIVA',
          description: dto.description?.trim() || occ.description,
          cost: dto.cost,
        },
      });
      await tx.operationalOccurrence.update({
        where: { id },
        data: {
          assetId,
          maintenanceRecordId: m.id,
          status: occ.status === OccurrenceStatus.OPEN ? OccurrenceStatus.IN_PROGRESS : undefined,
        },
      });
      return m;
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'CREATE',
      entity: 'MaintenanceRecord',
      entityId: record.id,
      after: { ...record, occurrenceId: id },
    });
    return record;
  }

  /** Equipamentos para vínculo (lista leve, sem exigir permissão de patrimônio). */
  async assetOptions(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.asset.findMany({
      select: { id: true, code: true, name: true, barnId: true },
      orderBy: { code: 'asc' },
    });
  }

  async countOpen(prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>) {
    return prisma.operationalOccurrence.count({
      where: { status: { in: [OccurrenceStatus.OPEN, OccurrenceStatus.IN_PROGRESS] } },
    });
  }
}
