import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { DailySummaryService } from './daily-summary.service';

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type PendingItem = {
  date: string;
  lot: { id: string; code: string };
  barn: { id: string; code: string; name: string };
  missing: string[];
  awaitingReview: Array<{ entity: string; id: string; kind: string; status: string }>;
};

/**
 * Pendências operacionais em um período: lançamentos faltantes (postura/ração por lote/dia)
 * e registros aguardando conferência.
 */
@Injectable()
export class PendingService {
  constructor(private readonly summary: DailySummaryService) {}

  async list(user: JwtPayload, from: string, to: string, barnId?: string) {
    const start = from.slice(0, 10);
    const end = to.slice(0, 10);
    if (start > end) throw new BadRequestException('Período inválido.');
    const days: string[] = [];
    for (let d = start; d <= end && days.length < 62; d = addDays(d, 1)) days.push(d);

    const items: PendingItem[] = [];
    let missingCount = 0;
    let awaitingCount = 0;
    let openOccurrences = 0;

    for (const day of days) {
      const s = await this.summary.forDate(user, day, barnId);
      if (day === end) openOccurrences = s.totals.openOccurrences;
      for (const r of s.rows) {
        const awaiting: PendingItem['awaitingReview'] = [];
        if (r.egg && r.egg.status !== 'REVIEWED') {
          awaiting.push({ entity: 'DailyEggProduction', id: r.egg.id, kind: 'postura', status: r.egg.status });
        }
        if (r.feed && r.feed.status !== 'REVIEWED') {
          awaiting.push({ entity: 'DailyFeedConsumption', id: r.feed.id, kind: 'racao', status: r.feed.status });
        }
        for (const m of r.mortality.records) {
          if (m.status !== 'REVIEWED') {
            awaiting.push({ entity: 'DailyMortality', id: m.id, kind: 'mortalidade', status: m.status });
          }
        }
        if (!r.pending.length && !awaiting.length) continue;
        missingCount += r.pending.length;
        awaitingCount += awaiting.length;
        items.push({ date: day, lot: r.lot, barn: r.barn, missing: r.pending, awaitingReview: awaiting });
      }
    }

    return {
      from: start,
      to: end,
      totals: { days: days.length, items: items.length, missing: missingCount, awaitingReview: awaitingCount, openOccurrences },
      items,
    };
  }
}
