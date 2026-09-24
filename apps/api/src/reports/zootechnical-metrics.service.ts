import { Injectable } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
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
      include: { breedLineage: { include: { standardPoints: true } } },
    });
    if (!lot) return null;

    const today = new Date();
    const ageDays = Math.floor((today.getTime() - lot.housingDate.getTime()) / 86400000);

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
    const liveBirds = Math.max(lot.housedQty - totalMortality, 1);

    const series = eggs.map((e) => {
      const commercial = this.production.commercialEggs(e);
      const layRatePct = (commercial / liveBirds) * 100;
      return {
        date: e.date,
        commercialEggs: commercial,
        layRatePct: Number(layRatePct.toFixed(2)),
      };
    });

    const standard = lot.breedLineage.standardPoints
      .slice()
      .sort((a, b) => a.ageDays - b.ageDays)
      .find((p) => p.ageDays >= ageDays) ??
      lot.breedLineage.standardPoints[lot.breedLineage.standardPoints.length - 1];

    const lastEgg = eggs[eggs.length - 1];
    const lastFeed = feeds[feeds.length - 1];
    let feedConversion: number | null = null;
    if (lastEgg && lastFeed) {
      const commercial = this.production.commercialEggs(lastEgg);
      const avgW = lastEgg.avgEggWeightG ? Number(lastEgg.avgEggWeightG) : 62;
      const eggMassKg = (commercial * avgW) / 1000;
      if (eggMassKg > 0) {
        feedConversion = Number((Number(lastFeed.consumedKg) / eggMassKg).toFixed(3));
      }
    }

    return {
      flockLotId,
      ageDays,
      liveBirds,
      standardLayRatePct: standard ? Number(standard.layRatePct) : null,
      currentLayRatePct: series.length ? series[series.length - 1].layRatePct : null,
      mortalityAccumulated: totalMortality,
      feedConversion,
      layRateSeries: series,
    };
  }

  async costPerDozen(tenantSlug: string, flockLotId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const eggs = await prisma.dailyEggProduction.findMany({ where: { flockLotId } });
    const feeds = await prisma.dailyFeedConsumption.findMany({ where: { flockLotId } });
    const commercialTotal = eggs.reduce((s, e) => s + this.production.commercialEggs(e), 0);
    const feedKg = feeds.reduce((s, f) => s + Number(f.consumedKg), 0);

    const feedMoves = await prisma.stockMovement.findMany({
      where: { product: { type: 'FEED' }, type: 'OUT' },
    });
    const feedCost = feedMoves.reduce(
      (s, m) => s + Number(m.quantity) * Number(m.unitCost ?? 0),
      0,
    );

    const dozens = commercialTotal / 12;
    return {
      flockLotId,
      commercialEggs: commercialTotal,
      feedKgTotal: feedKg,
      estimatedFeedCost: feedCost,
      costPerDozen: dozens > 0 ? Number((feedCost / dozens).toFixed(2)) : null,
    };
  }
}
