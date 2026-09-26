import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { filterLotsByBarnScope } from '../common/barn-scope';
import { loadUserNames, userLabel } from '../common/user-names';
import { FlockLotStatus, OccurrenceStatus, OperationRecordStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function dayRange(dateIso: string) {
  const d = dateIso.slice(0, 10);
  return { date: new Date(d), start: new Date(`${d}T00:00:00.000`), end: new Date(`${d}T23:59:59.999`) };
}

/**
 * Registro diário: consolida, por lote ativo, o que já foi lançado em uma data
 * (postura, mortalidade, ração, ocorrências) e o que está pendente.
 */
@Injectable()
export class DailySummaryService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async forDate(user: JwtPayload, dateIso: string, barnId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const { date, start, end } = dayRange(dateIso);

    const lotsRaw = await prisma.flockLot.findMany({
      where: {
        status: FlockLotStatus.ACTIVE,
        housingDate: { lte: date },
        ...(barnId ? { barnId } : {}),
      },
      include: { barn: { select: { id: true, code: true, name: true } } },
      orderBy: [{ barn: { code: 'asc' } }, { code: 'asc' }],
    });
    const lots = await filterLotsByBarnScope(user, lotsRaw);
    const lotIds = lots.map((l) => l.id);

    const [eggs, morts, feeds, occurrences] = await Promise.all([
      prisma.dailyEggProduction.findMany({ where: { flockLotId: { in: lotIds }, date } }),
      prisma.dailyMortality.findMany({ where: { flockLotId: { in: lotIds }, date } }),
      prisma.dailyFeedConsumption.findMany({ where: { flockLotId: { in: lotIds }, date } }),
      prisma.operationalOccurrence.findMany({
        where: {
          occurredAt: { gte: start, lte: end },
          ...(barnId ? { barnId } : {}),
          ...(user.barnIds.length ? { OR: [{ barnId: { in: user.barnIds } }, { barnId: null }] } : {}),
        },
        select: {
          id: true,
          controlNumber: true,
          type: true,
          priority: true,
          status: true,
          description: true,
          barnId: true,
          flockLotId: true,
          occurredAt: true,
        },
        orderBy: { occurredAt: 'desc' },
      }),
    ]);

    const names = await loadUserNames(prisma, [
      ...eggs.map((e) => e.createdByUserId),
      ...morts.map((m) => m.createdByUserId),
      ...feeds.map((f) => f.createdByUserId),
    ]);

    const eggByLot = new Map(eggs.map((e) => [e.flockLotId, e]));
    const feedByLot = new Map(feeds.map((f) => [f.flockLotId, f]));
    const mortByLot = new Map<string, typeof morts>();
    for (const m of morts) {
      const arr = mortByLot.get(m.flockLotId) ?? [];
      arr.push(m);
      mortByLot.set(m.flockLotId, arr);
    }

    const rows = lots.map((lot) => {
      const egg = eggByLot.get(lot.id) ?? null;
      const feed = feedByLot.get(lot.id) ?? null;
      const lotMorts = mortByLot.get(lot.id) ?? [];
      const lotOcc = occurrences.filter((o) => o.flockLotId === lot.id || (!o.flockLotId && o.barnId === lot.barnId));
      const produced = egg
        ? egg.extra + egg.large + egg.medium + egg.small + egg.cracked + egg.dirty + egg.deformed + egg.discard
        : 0;
      const commercial = egg ? egg.extra + egg.large + egg.medium + egg.small : 0;
      const pending: string[] = [];
      if (!egg) pending.push('postura');
      if (!feed) pending.push('racao');
      const awaitingReview = [
        egg && egg.status === OperationRecordStatus.RECORDED ? 'postura' : null,
        feed && feed.status === OperationRecordStatus.RECORDED ? 'racao' : null,
        lotMorts.some((m) => m.status === OperationRecordStatus.RECORDED) ? 'mortalidade' : null,
      ].filter((v): v is string => !!v);

      return {
        lot: { id: lot.id, code: lot.code, housedQty: lot.housedQty },
        barn: lot.barn,
        egg: egg
          ? {
              id: egg.id,
              produced,
              commercial,
              cracked: egg.cracked,
              dirty: egg.dirty,
              deformed: egg.deformed,
              discard: egg.discard,
              status: egg.status,
              createdByName: userLabel(names, egg.createdByUserId),
            }
          : null,
        mortality: {
          total: lotMorts.reduce((s, m) => s + m.quantity, 0),
          entries: lotMorts.length,
          records: lotMorts.map((m) => ({ id: m.id, status: m.status, quantity: m.quantity })),
          status: lotMorts.length
            ? lotMorts.every((m) => m.status !== OperationRecordStatus.RECORDED)
              ? OperationRecordStatus.REVIEWED
              : OperationRecordStatus.RECORDED
            : null,
        },
        feed: feed
          ? {
              id: feed.id,
              consumedKg: Number(feed.consumedKg),
              leftoverKg: Number(feed.leftoverKg),
              status: feed.status,
              createdByName: userLabel(names, feed.createdByUserId),
            }
          : null,
        occurrences: lotOcc,
        pending,
        awaitingReview,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.produced += r.egg?.produced ?? 0;
        acc.commercial += r.egg?.commercial ?? 0;
        acc.losses += r.egg ? r.egg.cracked + r.egg.dirty + r.egg.deformed : 0;
        acc.discard += r.egg?.discard ?? 0;
        acc.mortality += r.mortality.total;
        acc.feedKg += r.feed?.consumedKg ?? 0;
        acc.pendingLots += r.pending.length ? 1 : 0;
        acc.awaitingReview += r.awaitingReview.length;
        return acc;
      },
      { produced: 0, commercial: 0, losses: 0, discard: 0, mortality: 0, feedKg: 0, pendingLots: 0, awaitingReview: 0 },
    );
    const openOccurrences = occurrences.filter(
      (o) => o.status === OccurrenceStatus.OPEN || o.status === OccurrenceStatus.IN_PROGRESS,
    ).length;

    return { date: dateIso.slice(0, 10), rows, totals: { ...totals, openOccurrences }, occurrences };
  }
}
