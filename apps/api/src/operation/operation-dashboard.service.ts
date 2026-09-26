import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { filterLotsByBarnScope } from '../common/barn-scope';
import {
  FlockLotStatus,
  OccurrenceStatus,
  OperationRecordStatus,
  StockMovementType,
} from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { computeFlockBalance } from '../production/flock-balance.util';
import { ageDaysAt, feedConversion, standardAt } from '../production/lay-standard.util';
import { FEED_CONSUMPTION_REF } from './consumption-stock-sync.service';

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}
function pct(n: number, d: number, digits = 2) {
  return d > 0 ? Number(((n / d) * 100).toFixed(digits)) : null;
}
function round(n: number, digits = 2) {
  return Number(n.toFixed(digits));
}

export type DashboardFilters = { from: string; to: string; barnId?: string; flockLotId?: string };

/**
 * Dashboard operacional: indicadores consolidados com filtro por período, galpão e lote,
 * séries por dia, comparação por galpão/lote e padrão da linhagem por idade.
 */
@Injectable()
export class OperationDashboardService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async build(user: JwtPayload, f: DashboardFilters) {
    const from = f.from.slice(0, 10);
    const to = f.to.slice(0, 10);
    if (from > to) throw new BadRequestException('Período inválido.');
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const toEnd = new Date(`${to}T23:59:59.999`);

    // Lotes no escopo: ativos ou com registro no período
    const lotsRaw = await prisma.flockLot.findMany({
      where: {
        ...(f.flockLotId ? { id: f.flockLotId } : {}),
        ...(f.barnId ? { barnId: f.barnId } : {}),
        OR: [
          { status: FlockLotStatus.ACTIVE },
          { eggProductions: { some: { date: { gte: fromDate, lte: toDate } } } },
        ],
      },
      include: {
        barn: { select: { id: true, code: true, name: true } },
        breedLineage: { select: { id: true, name: true, standardPoints: true } },
        movements: { select: { type: true, quantity: true } },
      },
      orderBy: [{ barn: { code: 'asc' } }, { code: 'asc' }],
    });
    const lots = await filterLotsByBarnScope(user, lotsRaw);
    const lotIds = lots.map((l) => l.id);
    const barnIds = [...new Set(lots.map((l) => l.barnId))];

    const [eggs, morts, feeds, mortAll, losses, occurrences, feedMoves] = await Promise.all([
      prisma.dailyEggProduction.findMany({ where: { flockLotId: { in: lotIds }, date: { gte: fromDate, lte: toDate } } }),
      prisma.dailyMortality.findMany({ where: { flockLotId: { in: lotIds }, date: { gte: fromDate, lte: toDate } } }),
      prisma.dailyFeedConsumption.findMany({ where: { flockLotId: { in: lotIds }, date: { gte: fromDate, lte: toDate } } }),
      prisma.dailyMortality.groupBy({ by: ['flockLotId'], where: { flockLotId: { in: lotIds } }, _sum: { quantity: true } }),
      prisma.operationalLoss.findMany({
        where: {
          date: { gte: fromDate, lte: toDate },
          ...(f.flockLotId ? { flockLotId: f.flockLotId } : {}),
          ...(f.barnId ? { barnId: f.barnId } : user.barnIds.length ? { OR: [{ barnId: { in: user.barnIds } }, { barnId: null }] } : {}),
        },
      }),
      prisma.operationalOccurrence.findMany({
        where: {
          occurredAt: { gte: fromDate, lte: toEnd },
          ...(f.flockLotId ? { flockLotId: f.flockLotId } : {}),
          ...(f.barnId ? { barnId: f.barnId } : user.barnIds.length ? { OR: [{ barnId: { in: user.barnIds } }, { barnId: null }] } : {}),
        },
        include: { barn: { select: { code: true, name: true } }, flockLot: { select: { code: true } } },
        orderBy: { occurredAt: 'desc' },
      }),
      prisma.stockMovement.findMany({
        where: { type: StockMovementType.OUT, reference: { startsWith: FEED_CONSUMPTION_REF } },
        select: { reference: true, quantity: true, unitCost: true },
      }),
    ]);

    const mortTotalByLot = new Map(mortAll.map((m) => [m.flockLotId, m._sum.quantity ?? 0]));
    const feedCostByFeedId = new Map<string, number>();
    for (const m of feedMoves) {
      const id = m.reference?.slice(FEED_CONSUMPTION_REF.length);
      if (!id) continue;
      feedCostByFeedId.set(id, (feedCostByFeedId.get(id) ?? 0) + Number(m.quantity) * Number(m.unitCost ?? 0));
    }

    const commercialOf = (e: { extra: number; large: number; medium: number; small: number }) =>
      e.extra + e.large + e.medium + e.small;
    const producedOf = (e: (typeof eggs)[number]) => commercialOf(e) + e.cracked + e.dirty + e.deformed + e.discard;
    const lossOf = (e: (typeof eggs)[number]) => e.cracked + e.dirty + e.deformed + e.discard;

    // --- Por lote ---
    const lotRows = lots.map((lot) => {
      const balance = computeFlockBalance(lot.housedQty, lot.movements, mortTotalByLot.get(lot.id) ?? 0);
      const lEggs = eggs.filter((e) => e.flockLotId === lot.id);
      const lMorts = morts.filter((m) => m.flockLotId === lot.id);
      const lFeeds = feeds.filter((x) => x.flockLotId === lot.id);
      const commercial = lEggs.reduce((s, e) => s + commercialOf(e), 0);
      const produced = lEggs.reduce((s, e) => s + producedOf(e), 0);
      const lossEggs = lEggs.reduce((s, e) => s + lossOf(e), 0);
      const mortality = lMorts.reduce((s, m) => s + m.quantity, 0);
      const feedKg = lFeeds.reduce((s, x) => s + Number(x.consumedKg), 0);
      const days = lEggs.length || 1;
      const ageDays = ageDaysAt(lot.housingDate, toDate);
      const std = standardAt(lot.breedLineage.standardPoints, ageDays);
      const layRatePct = balance.liveBirds > 0 && lEggs.length ? pct(commercial / lEggs.length, balance.liveBirds) : null;

      // conversão alimentar: janela dos últimos 7 dias com postura e ração pareadas
      const feedByDate = new Map(lFeeds.map((x) => [isoDate(x.date), Number(x.consumedKg)]));
      const pairs = lEggs
        .slice()
        .sort((a, b) => b.date.getTime() - a.date.getTime())
        .filter((e) => feedByDate.has(isoDate(e.date)))
        .slice(0, 7)
        .map((e) => ({
          consumedKg: feedByDate.get(isoDate(e.date))!,
          commercialEggs: commercialOf(e),
          avgEggWeightG: e.avgEggWeightG != null ? Number(e.avgEggWeightG) : std?.avgEggWeightG ?? null,
        }));
      const fcr7 = feedConversion(pairs);

      // custo por dúzia do lote: baixas de ração vinculadas aos registros do lote
      const feedCost = lFeeds.reduce((s, x) => s + (feedCostByFeedId.get(x.id) ?? 0), 0);
      const dozens = commercial / 12;

      return {
        lot: { id: lot.id, code: lot.code, status: lot.status },
        barn: lot.barn,
        lineage: lot.breedLineage.name,
        ageDays,
        ageWeeks: Math.floor(ageDays / 7),
        housedQty: lot.housedQty,
        liveBirds: balance.liveBirds,
        produced,
        commercial,
        lossEggs,
        lossPct: pct(lossEggs, produced),
        layRatePct,
        standardLayRatePct: std?.layRatePct ?? null,
        layGapPct: layRatePct != null && std ? round(layRatePct - std.layRatePct) : null,
        mortality,
        mortalityPct: pct(mortality, lot.housedQty, 3),
        feedKg: round(feedKg, 1),
        feedGPerBirdDay: balance.liveBirds > 0 && lFeeds.length ? round((feedKg * 1000) / lFeeds.length / balance.liveBirds, 1) : null,
        feedConversion7d: fcr7,
        feedCost: round(feedCost),
        costPerDozen: dozens > 0 && feedCost > 0 ? round(feedCost / dozens) : null,
        recordedDays: days,
      };
    });

    // --- Série por dia ---
    const dayList: string[] = [];
    for (let d = from; d <= to && dayList.length < 400; d = addDays(d, 1)) dayList.push(d);
    const liveByLot = new Map(lotRows.map((r) => [r.lot.id, r.liveBirds]));
    const series = dayList.map((day) => {
      const dEggs = eggs.filter((e) => isoDate(e.date) === day);
      const dMorts = morts.filter((m) => isoDate(m.date) === day);
      const dFeeds = feeds.filter((x) => isoDate(x.date) === day);
      const commercial = dEggs.reduce((s, e) => s + commercialOf(e), 0);
      const produced = dEggs.reduce((s, e) => s + producedOf(e), 0);
      const live = dEggs.reduce((s, e) => s + (liveByLot.get(e.flockLotId) ?? 0), 0);
      // padrão ponderado pelas aves de cada lote com registro no dia
      let stdWeighted = 0;
      let stdWeight = 0;
      for (const e of dEggs) {
        const lot = lots.find((l) => l.id === e.flockLotId);
        if (!lot) continue;
        const std = standardAt(lot.breedLineage.standardPoints, ageDaysAt(lot.housingDate, new Date(day)));
        const w = liveByLot.get(lot.id) ?? 0;
        if (std && w > 0) {
          stdWeighted += std.layRatePct * w;
          stdWeight += w;
        }
      }
      return {
        date: day,
        produced,
        commercial,
        lossEggs: dEggs.reduce((s, e) => s + lossOf(e), 0),
        layRatePct: pct(commercial, live),
        standardLayRatePct: stdWeight > 0 ? round(stdWeighted / stdWeight) : null,
        mortality: dMorts.reduce((s, m) => s + m.quantity, 0),
        feedKg: round(dFeeds.reduce((s, x) => s + Number(x.consumedKg), 0), 1),
        lotsRecorded: dEggs.length,
      };
    });

    // --- Por galpão ---
    const byBarn = barnIds.map((bid) => {
      const rows = lotRows.filter((r) => r.barn.id === bid);
      const barn = rows[0]?.barn;
      const live = rows.reduce((s, r) => s + r.liveBirds, 0);
      const commercial = rows.reduce((s, r) => s + r.commercial, 0);
      const recordedDays = Math.max(...rows.map((r) => r.recordedDays), 1);
      return {
        barn,
        lots: rows.length,
        liveBirds: live,
        produced: rows.reduce((s, r) => s + r.produced, 0),
        commercial,
        layRatePct: live > 0 ? pct(commercial / recordedDays, live) : null,
        lossPct: pct(rows.reduce((s, r) => s + r.lossEggs, 0), rows.reduce((s, r) => s + r.produced, 0)),
        mortality: rows.reduce((s, r) => s + r.mortality, 0),
        feedKg: round(rows.reduce((s, r) => s + r.feedKg, 0), 1),
        openOccurrences: occurrences.filter(
          (o) => o.barnId === bid && (o.status === OccurrenceStatus.OPEN || o.status === OccurrenceStatus.IN_PROGRESS),
        ).length,
      };
    });

    // --- Totais ---
    const produced = lotRows.reduce((s, r) => s + r.produced, 0);
    const commercial = lotRows.reduce((s, r) => s + r.commercial, 0);
    const lossEggs = lotRows.reduce((s, r) => s + r.lossEggs, 0);
    const liveBirds = lotRows.reduce((s, r) => s + r.liveBirds, 0);
    const mortality = lotRows.reduce((s, r) => s + r.mortality, 0);
    const feedKg = lotRows.reduce((s, r) => s + r.feedKg, 0);
    const daysWithData = series.filter((s) => s.lotsRecorded > 0).length;
    const stdSeries = series.filter((s) => s.standardLayRatePct != null);
    const totalFeedCost = lotRows.reduce((s, r) => s + r.feedCost, 0);

    const lossByType = new Map<string, { quantity: number; cost: number; count: number }>();
    for (const l of losses) {
      const b = lossByType.get(l.type) ?? { quantity: 0, cost: 0, count: 0 };
      b.quantity += Number(l.quantity);
      b.cost += Number(l.estimatedCost ?? 0);
      b.count += 1;
      lossByType.set(l.type, b);
    }

    const openOcc = occurrences.filter((o) => o.status === OccurrenceStatus.OPEN || o.status === OccurrenceStatus.IN_PROGRESS);
    const awaitingReview =
      eggs.filter((e) => e.status === OperationRecordStatus.RECORDED).length +
      morts.filter((m) => m.status === OperationRecordStatus.RECORDED).length +
      feeds.filter((x) => x.status === OperationRecordStatus.RECORDED).length;

    return {
      filters: { from, to, barnId: f.barnId ?? null, flockLotId: f.flockLotId ?? null },
      totals: {
        lots: lotRows.length,
        barns: barnIds.length,
        liveBirds,
        produced,
        commercial,
        lossEggs,
        lossPct: pct(lossEggs, produced),
        layRatePct: liveBirds > 0 && daysWithData ? pct(commercial / daysWithData, liveBirds) : null,
        standardLayRatePct: stdSeries.length
          ? round(stdSeries.reduce((s, x) => s + (x.standardLayRatePct ?? 0), 0) / stdSeries.length)
          : null,
        mortality,
        mortalityPct: pct(mortality, lotRows.reduce((s, r) => s + r.housedQty, 0), 3),
        feedKg: round(feedKg, 1),
        feedGPerBirdDay: liveBirds > 0 && daysWithData ? round((feedKg * 1000) / daysWithData / liveBirds, 1) : null,
        feedCost: round(totalFeedCost),
        costPerDozen: commercial > 0 && totalFeedCost > 0 ? round(totalFeedCost / (commercial / 12)) : null,
        operationalLossCost: round(losses.reduce((s, l) => s + Number(l.estimatedCost ?? 0), 0)),
        openOccurrences: openOcc.length,
        criticalOccurrences: openOcc.filter((o) => o.priority === 'CRITICAL' || o.priority === 'HIGH').length,
        awaitingReview,
        daysWithData,
      },
      series,
      byBarn,
      byLot: lotRows,
      losses: [...lossByType.entries()].map(([type, v]) => ({ type, ...v, cost: round(v.cost) })),
      occurrences: openOcc.slice(0, 20).map((o) => ({
        id: o.id,
        occurredAt: o.occurredAt,
        type: o.type,
        priority: o.priority,
        status: o.status,
        description: o.description,
        barn: o.barn?.name ?? null,
        lot: o.flockLot?.code ?? null,
      })),
    };
  }
}
