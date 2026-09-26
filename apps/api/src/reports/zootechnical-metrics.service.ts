import { Injectable } from '@nestjs/common';
import { StockMovementType } from '../generated/tenant-client';
import { averageCostByProduct } from '../inventory/product-cost.util';
import { FEED_CONSUMPTION_REF } from '../operation/consumption-stock-sync.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { computeFlockBalance } from '../production/flock-balance.util';
import { ageDaysAt, feedConversion, standardAt } from '../production/lay-standard.util';
import { ProductionService } from '../production/production.service';

@Injectable()
export class ZootechnicalMetricsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly production: ProductionService,
  ) {}

  async dashboard(tenantSlug: string, flockLotId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const lot = await prisma.flockLot.findUnique({
      where: { id: flockLotId },
      include: {
        breedLineage: { include: { standardPoints: true } },
        movements: { select: { type: true, quantity: true } },
      },
    });
    if (!lot) return null;

    const today = new Date();
    const ageDays = ageDaysAt(lot.housingDate, today);

    const eggsRecent = await prisma.dailyEggProduction.findMany({
      where: { flockLotId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    const eggs = eggsRecent.slice().reverse();
    const mortalities = await prisma.dailyMortality.findMany({ where: { flockLotId } });
    const feedsRecent = await prisma.dailyFeedConsumption.findMany({
      where: { flockLotId },
      orderBy: { date: 'desc' },
      take: 30,
    });
    const feeds = feedsRecent.slice().reverse();

    const totalMortality = mortalities.reduce((s, m) => s + m.quantity, 0);
    // aves vivas = alojadas + movimentações − mortalidade (mesma regra do saldo do lote)
    const balance = computeFlockBalance(lot.housedQty, lot.movements, totalMortality);
    const liveBirds = Math.max(balance.liveBirds, 1);

    // padrão da linhagem dia a dia (pela idade do lote em cada data)
    const points = lot.breedLineage.standardPoints;
    const series = eggs.map((e) => {
      const commercial = this.production.commercialEggs(e);
      const layRatePct = (commercial / liveBirds) * 100;
      const std = standardAt(points, ageDaysAt(lot.housingDate, e.date));
      return {
        date: e.date,
        commercialEggs: commercial,
        layRatePct: Number(layRatePct.toFixed(2)),
        standardLayRatePct: std?.layRatePct ?? null,
      };
    });

    const standardToday = standardAt(points, ageDays);

    // conversão alimentar em janela: últimos 7 dias com postura e ração pareadas por data
    const feedByDate = new Map(feeds.map((f) => [f.date.toISOString().slice(0, 10), Number(f.consumedKg)]));
    const pairs = eggs
      .slice()
      .reverse()
      .filter((e) => feedByDate.has(e.date.toISOString().slice(0, 10)))
      .slice(0, 7)
      .map((e) => ({
        consumedKg: feedByDate.get(e.date.toISOString().slice(0, 10))!,
        commercialEggs: this.production.commercialEggs(e),
        avgEggWeightG:
          e.avgEggWeightG != null
            ? Number(e.avgEggWeightG)
            : standardAt(points, ageDaysAt(lot.housingDate, e.date))?.avgEggWeightG ?? null,
      }));
    const feedConversion7d = feedConversion(pairs);

    return {
      flockLotId,
      ageDays,
      liveBirds: balance.liveBirds,
      balance,
      standardLayRatePct: standardToday?.layRatePct ?? null,
      currentLayRatePct: series.length ? series[series.length - 1].layRatePct : null,
      mortalityAccumulated: totalMortality,
      feedConversion: feedConversion7d,
      feedConversionWindowDays: pairs.length,
      layRateSeries: series,
    };
  }

  async costPerDozen(tenantSlug: string, flockLotId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const eggs = await prisma.dailyEggProduction.findMany({ where: { flockLotId } });
    const feeds = await prisma.dailyFeedConsumption.findMany({ where: { flockLotId } });
    const commercialTotal = eggs.reduce((s, e) => s + this.production.commercialEggs(e), 0);
    const feedKg = feeds.reduce((s, f) => s + Number(f.consumedKg), 0);

    // 1) custo real: baixas de ração vinculadas aos registros deste lote
    const refs = feeds.map((f) => `${FEED_CONSUMPTION_REF}${f.id}`);
    const linkedMoves = refs.length
      ? await prisma.stockMovement.findMany({
          where: { type: StockMovementType.OUT, reference: { in: refs } },
          select: { quantity: true, unitCost: true },
        })
      : [];
    let feedCost = linkedMoves.reduce((s, m) => s + Number(m.quantity) * Number(m.unitCost ?? 0), 0);
    let costSource: 'linked' | 'average' | 'none' = feedCost > 0 ? 'linked' : 'none';

    // 2) fallback: kg consumidos × custo médio dos produtos de ração
    if (feedCost <= 0 && feedKg > 0) {
      const feedProducts = await prisma.product.findMany({ where: { type: 'FEED' }, select: { id: true } });
      const ids = feedProducts.map((p) => p.id);
      if (ids.length) {
        const moves = await prisma.stockMovement.findMany({
          where: { productId: { in: ids } },
          orderBy: [{ movedAt: 'asc' }, { id: 'asc' }],
          select: { productId: true, type: true, quantity: true, unitCost: true },
        });
        const costs = averageCostByProduct(moves);
        const withCost = [...costs.values()].filter((c) => c.averageCost > 0);
        if (withCost.length) {
          const totalQty = withCost.reduce((s, c) => s + Math.max(c.qty, 0), 0);
          const avg = totalQty > 0
            ? withCost.reduce((s, c) => s + c.averageCost * Math.max(c.qty, 0), 0) / totalQty
            : withCost.reduce((s, c) => s + c.averageCost, 0) / withCost.length;
          feedCost = feedKg * avg;
          costSource = 'average';
        }
      }
    }

    const dozens = commercialTotal / 12;
    return {
      flockLotId,
      commercialEggs: commercialTotal,
      feedKgTotal: feedKg,
      estimatedFeedCost: Number(feedCost.toFixed(2)),
      costSource,
      costPerDozen: dozens > 0 && feedCost > 0 ? Number((feedCost / dozens).toFixed(2)) : null,
    };
  }
}
