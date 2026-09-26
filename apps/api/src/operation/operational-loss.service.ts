import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess } from '../common/barn-scope';
import { loadUserNames, userLabel } from '../common/user-names';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { UpsertOperationalLossDto } from './dto/operational-loss.dto';

const INCLUDE = {
  barn: { select: { id: true, code: true, name: true } },
  flockLot: { select: { id: true, code: true } },
  product: { select: { id: true, sku: true, name: true, unit: true } },
} as const;

@Injectable()
export class OperationalLossService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(user: JwtPayload, filters: { from?: string; to?: string; barnId?: string; type?: string }) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.operationalLoss.findMany({
      where: {
        ...(filters.barnId ? { barnId: filters.barnId } : {}),
        ...(filters.type ? { type: filters.type as never } : {}),
        ...(filters.from || filters.to
          ? {
              date: {
                ...(filters.from ? { gte: new Date(filters.from) } : {}),
                ...(filters.to ? { lte: new Date(filters.to) } : {}),
              },
            }
          : {}),
        ...(user.barnIds.length ? { OR: [{ barnId: { in: user.barnIds } }, { barnId: null }] } : {}),
      },
      include: INCLUDE,
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    });
    const names = await loadUserNames(prisma, rows.map((r) => r.createdByUserId));
    return rows.map((r) => ({ ...r, createdByName: userLabel(names, r.createdByUserId) }));
  }

  private async resolveBarn(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    user: JwtPayload,
    dto: { barnId?: string; flockLotId?: string },
  ) {
    let barnId = dto.barnId;
    if (dto.flockLotId) {
      const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
      if (!lot) throw new NotFoundException('Lote não encontrado');
      barnId = barnId ?? lot.barnId;
    }
    if (barnId) assertBarnAccess(user, barnId);
    return barnId;
  }

  private data(dto: UpsertOperationalLossDto, barnId: string | undefined) {
    return {
      date: new Date(dto.date),
      type: dto.type,
      barnId: barnId ?? null,
      flockLotId: dto.flockLotId ?? null,
      productId: dto.productId ?? null,
      location: dto.location?.trim() || null,
      quantity: dto.quantity,
      unit: dto.unit?.trim() || 'UN',
      reason: dto.reason?.trim() || null,
      actionTaken: dto.actionTaken?.trim() || null,
      notes: dto.notes?.trim() || null,
      estimatedCost: dto.estimatedCost ?? null,
    };
  }

  async create(user: JwtPayload, dto: UpsertOperationalLossDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const barnId = await this.resolveBarn(prisma, user, dto);
    const row = await prisma.operationalLoss.create({
      data: { ...this.data(dto, barnId), createdByUserId: user.sub },
      include: INCLUDE,
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'CREATE',
      entity: 'OperationalLoss',
      entityId: row.id,
      after: row,
    });
    return row;
  }

  async update(user: JwtPayload, id: string, dto: UpsertOperationalLossDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const before = await prisma.operationalLoss.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Registro não encontrado');
    if (before.barnId) assertBarnAccess(user, before.barnId);
    const barnId = await this.resolveBarn(prisma, user, dto);
    const row = await prisma.operationalLoss.update({
      where: { id },
      data: this.data(dto, barnId),
      include: INCLUDE,
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'UPDATE',
      entity: 'OperationalLoss',
      entityId: id,
      before,
      after: row,
    });
    return row;
  }
}
