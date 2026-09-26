import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess } from '../common/barn-scope';
import { OperationRecordStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EggProductionStockService } from '../production/egg-production-stock.service';
import { ConsumptionStockSyncService } from './consumption-stock-sync.service';
import { loadOperationSettings } from './operation-settings.service';

export const REVIEWABLE_ENTITIES = [
  'DailyEggProduction',
  'DailyMortality',
  'DailyFeedConsumption',
  'SupplyConsumption',
] as const;
export type ReviewableEntity = (typeof REVIEWABLE_ENTITIES)[number];

export function isReviewableEntity(v: string): v is ReviewableEntity {
  return (REVIEWABLE_ENTITIES as readonly string[]).includes(v);
}

type Client = Awaited<ReturnType<TenantPrismaService['getClient']>>;

/**
 * Conferência de registros operacionais: RECORDED → REVIEWED (ou ADJUSTED → REVIEWED),
 * com responsável e data. Ao conferir, dispara as integrações com estoque
 * (ração/insumos; ovos quando configurado para sincronizar só após conferência).
 */
@Injectable()
export class ReviewService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly stockSync: ConsumptionStockSyncService,
    private readonly eggStock: EggProductionStockService,
  ) {}

  private async loadWithBarn(prisma: Client, entity: ReviewableEntity, id: string) {
    switch (entity) {
      case 'DailyEggProduction': {
        const r = await prisma.dailyEggProduction.findUnique({ where: { id }, include: { flockLot: true } });
        return r ? { row: r, barnId: r.flockLot.barnId } : null;
      }
      case 'DailyMortality': {
        const r = await prisma.dailyMortality.findUnique({ where: { id }, include: { flockLot: true } });
        return r ? { row: r, barnId: r.flockLot.barnId } : null;
      }
      case 'DailyFeedConsumption': {
        const r = await prisma.dailyFeedConsumption.findUnique({ where: { id }, include: { flockLot: true } });
        return r ? { row: r, barnId: r.flockLot.barnId } : null;
      }
      case 'SupplyConsumption': {
        const r = await prisma.supplyConsumption.findUnique({ where: { id } });
        return r ? { row: r, barnId: r.barnId } : null;
      }
    }
  }

  private async setReviewed(prisma: Client, entity: ReviewableEntity, id: string, userId: string) {
    const data = {
      status: OperationRecordStatus.REVIEWED,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    };
    switch (entity) {
      case 'DailyEggProduction':
        return prisma.dailyEggProduction.update({ where: { id }, data });
      case 'DailyMortality':
        return prisma.dailyMortality.update({ where: { id }, data });
      case 'DailyFeedConsumption':
        return prisma.dailyFeedConsumption.update({ where: { id }, data });
      case 'SupplyConsumption':
        return prisma.supplyConsumption.update({ where: { id }, data });
    }
  }

  private async afterReview(user: JwtPayload, prisma: Client, entity: ReviewableEntity, id: string) {
    if (entity === 'DailyFeedConsumption') await this.stockSync.syncFeed(user.tenantSlug, id);
    if (entity === 'SupplyConsumption') await this.stockSync.syncSupply(user.tenantSlug, id);
    if (entity === 'DailyEggProduction') {
      const settings = await loadOperationSettings(prisma);
      if (settings.eggSyncOnlyReviewed) {
        const row = await prisma.dailyEggProduction.findUnique({ where: { id } });
        if (row) await this.eggStock.syncFromProduction(user, row);
      }
    }
  }

  async review(user: JwtPayload, entity: string, id: string, note?: string) {
    if (!isReviewableEntity(entity)) throw new BadRequestException('Entidade não suportada para conferência.');
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const found = await this.loadWithBarn(prisma, entity, id);
    if (!found) throw new NotFoundException('Registro não encontrado');
    if (found.barnId) assertBarnAccess(user, found.barnId);
    const before = found.row as { status: OperationRecordStatus };
    if (before.status === OperationRecordStatus.REVIEWED) {
      return { entity, id, status: before.status, changed: false };
    }
    const after = await this.setReviewed(prisma, entity, id, user.sub);
    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'REVIEW',
      entity,
      entityId: id,
      before: found.row,
      after,
      reason: note,
    });
    await this.afterReview(user, prisma, entity, id);
    return { entity, id, status: after.status, changed: true };
  }

  async reviewMany(user: JwtPayload, items: { entity: string; id: string }[], note?: string) {
    const results: Array<{ entity: string; id: string; status?: string; changed?: boolean; error?: string }> = [];
    for (const it of items) {
      try {
        results.push(await this.review(user, it.entity, it.id, note));
      } catch (e) {
        results.push({ entity: it.entity, id: it.id, error: (e as Error).message });
      }
    }
    return { total: items.length, reviewed: results.filter((r) => r.changed).length, results };
  }

  /** Confere todos os registros ainda em RECORDED/ADJUSTED de uma data (opcionalmente de um galpão). */
  async reviewDay(user: JwtPayload, dateIso: string, barnId?: string, note?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const date = new Date(dateIso.slice(0, 10));
    const pending = { in: [OperationRecordStatus.RECORDED, OperationRecordStatus.ADJUSTED] };
    const lotFilter = {
      flockLot: {
        ...(barnId ? { barnId } : {}),
        ...(user.barnIds.length ? { barnId: { in: user.barnIds } } : {}),
      },
    };
    const [eggs, morts, feeds, supplies] = await Promise.all([
      prisma.dailyEggProduction.findMany({ where: { date, status: pending, ...lotFilter }, select: { id: true } }),
      prisma.dailyMortality.findMany({ where: { date, status: pending, ...lotFilter }, select: { id: true } }),
      prisma.dailyFeedConsumption.findMany({ where: { date, status: pending, ...lotFilter }, select: { id: true } }),
      prisma.supplyConsumption.findMany({
        where: {
          date,
          status: pending,
          ...(barnId ? { barnId } : {}),
          ...(user.barnIds.length ? { OR: [{ barnId: { in: user.barnIds } }, { barnId: null }] } : {}),
        },
        select: { id: true },
      }),
    ]);
    const items = [
      ...eggs.map((r) => ({ entity: 'DailyEggProduction', id: r.id })),
      ...morts.map((r) => ({ entity: 'DailyMortality', id: r.id })),
      ...feeds.map((r) => ({ entity: 'DailyFeedConsumption', id: r.id })),
      ...supplies.map((r) => ({ entity: 'SupplyConsumption', id: r.id })),
    ];
    return this.reviewMany(user, items, note);
  }
}
