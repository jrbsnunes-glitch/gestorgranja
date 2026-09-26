import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess } from '../common/barn-scope';
import { loadUserNames, userLabel } from '../common/user-names';
import { OperationRecordStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ConsumptionStockSyncService } from './consumption-stock-sync.service';
import { UpsertSupplyConsumptionDto } from './dto/supply-consumption.dto';

const INCLUDE = {
  barn: { select: { id: true, code: true, name: true } },
  flockLot: { select: { id: true, code: true } },
  product: { select: { id: true, sku: true, name: true, unit: true, type: true } },
  stockLocation: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class SupplyConsumptionService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stockSync: ConsumptionStockSyncService,
  ) {}

  private hasPermission(user: JwtPayload, code: string) {
    return user.permissions.includes('*') || user.permissions.includes(code);
  }

  /** Produtos para seleção na operação (lista leve; não exige permissão de estoque). */
  async productOptions(user: JwtPayload, type?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.product.findMany({
      where: type ? { type: type as never } : undefined,
      select: { id: true, sku: true, name: true, unit: true, type: true },
      orderBy: { name: 'asc' },
    });
  }

  async stockLocationOptions(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.stockLocation.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, barnId: true },
      orderBy: { code: 'asc' },
    });
  }

  async list(user: JwtPayload, filters: { from?: string; to?: string; barnId?: string; productId?: string }) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.supplyConsumption.findMany({
      where: {
        ...(filters.barnId ? { barnId: filters.barnId } : {}),
        ...(filters.productId ? { productId: filters.productId } : {}),
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

  async create(user: JwtPayload, dto: UpsertSupplyConsumptionDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const barnId = await this.resolveBarn(prisma, user, dto);
    const product = await prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Produto não encontrado');

    const row = await prisma.supplyConsumption.create({
      data: {
        date: new Date(dto.date),
        barnId,
        flockLotId: dto.flockLotId,
        productId: dto.productId,
        stockLocationId: dto.stockLocationId,
        kind: dto.kind,
        quantity: dto.quantity,
        unit: dto.unit?.trim() || product.unit,
        notes: dto.notes?.trim() || undefined,
        createdByUserId: user.sub,
      },
      include: INCLUDE,
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'CREATE',
      entity: 'SupplyConsumption',
      entityId: row.id,
      after: row,
    });
    await this.stockSync.syncSupply(user.tenantSlug, row.id);
    return row;
  }

  async update(user: JwtPayload, id: string, dto: UpsertSupplyConsumptionDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const before = await prisma.supplyConsumption.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Registro não encontrado');
    if (before.barnId) assertBarnAccess(user, before.barnId);
    const locked =
      before.status === OperationRecordStatus.REVIEWED || before.status === OperationRecordStatus.ADJUSTED;
    if (locked) {
      if (!this.hasPermission(user, 'production.adjust')) {
        throw new ForbiddenException('Registro já conferido: alteração exige permissão de ajuste autorizado.');
      }
      if (!dto.reason?.trim()) throw new BadRequestException('Informe a justificativa para alterar um registro conferido.');
    }
    const barnId = await this.resolveBarn(prisma, user, dto);

    // troca de produto/local/tipo com baixa já feita: reverte antes de regravar
    if (
      before.productId !== dto.productId ||
      (before.stockLocationId ?? null) !== (dto.stockLocationId ?? null) ||
      before.kind !== dto.kind
    ) {
      await this.stockSync.unsyncSupply(user.tenantSlug, before.id);
    }

    const row = await prisma.supplyConsumption.update({
      where: { id },
      data: {
        date: new Date(dto.date),
        barnId: barnId ?? null,
        flockLotId: dto.flockLotId ?? null,
        productId: dto.productId,
        stockLocationId: dto.stockLocationId ?? null,
        kind: dto.kind,
        quantity: dto.quantity,
        unit: dto.unit?.trim() || undefined,
        notes: dto.notes?.trim() || null,
        ...(before.status === OperationRecordStatus.REVIEWED ? { status: OperationRecordStatus.ADJUSTED } : {}),
      },
      include: INCLUDE,
    });
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'UPDATE',
      entity: 'SupplyConsumption',
      entityId: id,
      before,
      after: row,
      reason: dto.reason,
    });
    await this.stockSync.syncSupply(user.tenantSlug, row.id);
    return row;
  }
}
