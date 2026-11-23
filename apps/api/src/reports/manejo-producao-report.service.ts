import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { filterLotsByBarnScope } from '../common/barn-scope';
import { calendarDayKeyInTz, prismaDateOnly, prismaDateToDayKey } from '../common/calendar-date.util';
import { loadUserNames, userLabel } from '../common/user-names';
import { readCompanyLogoDataUrl } from '../cadastros/company-logo.util';
import { FlockLotStatus } from '../generated/tenant-client';
import { computeFlockBalance } from '../production/flock-balance.util';
import { flockAgeDays, standardAt } from '../production/lay-standard.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type ManejoSheetRow = {
  lotBarn: string;
  ageWeeks: string;
  dead: string;
  live: string;
  intact: string;
  defects: string;
  total: string;
  prodPct: string;
  idealPct: string;
  water: string;
  feed: string;
  lineage: string;
  worker: string;
};

export type ManejoHealthRow = {
  signs: string;
  treatment: string;
  guidance: string;
};

const EMPTY_ROW: ManejoSheetRow = {
  lotBarn: '',
  ageWeeks: '',
  dead: '',
  live: '',
  intact: '',
  defects: '',
  total: '',
  prodPct: '',
  idealPct: '',
  water: '',
  feed: '',
  lineage: '',
  worker: '',
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function fmtQty(value: number | null, digits = 0): string {
  if (value == null) return '';
  return value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

function fmtPct(value: number | null): string {
  if (value == null) return '';
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

@Injectable()
export class ManejoProducaoReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, dateRaw?: string) {
    const dayKey = (dateRaw ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) {
      throw new BadRequestException('Informe a data da ficha (AAAA-MM-DD).');
    }
    const day = prismaDateOnly(dayKey);
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    const lots = await prisma.flockLot.findMany({
      where: { housingDate: { lte: day } },
      include: {
        barn: true,
        breedLineage: { include: { standardPoints: true } },
        mortalities: { where: { date: { lte: day } }, select: { date: true, quantity: true } },
        movements: { where: { date: { lte: day } }, select: { type: true, quantity: true, date: true } },
        eggProductions: { where: { date: day } },
        feedConsumptions: { where: { date: day } },
        manejoRecords: { where: { date: day } },
        healthEvents: {
          where: {
            appliedAt: {
              gte: new Date(`${dayKey}T00:00:00.000Z`),
              lt: new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + 2 * 86400000),
            },
          },
        },
      },
      orderBy: [{ barn: { code: 'asc' } }, { code: 'asc' }],
    });
    const open = lots.filter((lot) => {
      if (lot.status === FlockLotStatus.ACTIVE) return true;
      if (!lot.finishedAt) return false;
      return calendarDayKeyInTz(lot.finishedAt) >= dayKey;
    });
    const scoped = await filterLotsByBarnScope(user, open);

    const userIds = scoped.flatMap((lot) => [
      lot.barn.responsibleUserId,
      lot.eggProductions[0]?.createdByUserId,
      lot.feedConsumptions[0]?.createdByUserId,
      ...lot.mortalities.filter((m) => prismaDateToDayKey(m.date) === dayKey).map(() => null),
    ]);
    const mortalityAuthors = await prisma.dailyMortality.findMany({
      where: { date: day, flockLotId: { in: scoped.map((l) => l.id) } },
      select: { flockLotId: true, createdByUserId: true },
    });
    const names = await loadUserNames(prisma, [
      ...userIds,
      ...mortalityAuthors.map((m) => m.createdByUserId),
    ]);
    const mortAuthor = new Map(mortalityAuthors.map((m) => [m.flockLotId, m.createdByUserId]));

    const rows: ManejoSheetRow[] = scoped.map((lot) => {
      const deadToday = lot.mortalities
        .filter((m) => prismaDateToDayKey(m.date) === dayKey)
        .reduce((s, m) => s + m.quantity, 0);
      const mortalityTotal = lot.mortalities.reduce((s, m) => s + m.quantity, 0);
      const balance = computeFlockBalance(lot.housedQty, lot.movements, mortalityTotal);
      const egg = lot.eggProductions[0];
      const intact = egg ? egg.extra + egg.large + egg.medium + egg.small : null;
      const defects = egg ? egg.cracked + egg.dirty + egg.deformed + egg.discard : null;
      const total = intact != null && defects != null ? intact + defects : null;
      const prodPct = total != null && balance.liveBirds > 0 ? (total / balance.liveBirds) * 100 : null;
      const ageDays = flockAgeDays(lot.housingDate, day, lot.initialAgeWeeks);
      const ideal = standardAt(lot.breedLineage.standardPoints, ageDays);
      const feed = lot.feedConsumptions[0];
      const manejo = lot.manejoRecords[0];
      const workerId =
        egg?.createdByUserId ||
        feed?.createdByUserId ||
        mortAuthor.get(lot.id) ||
        lot.barn.responsibleUserId;
      const worker = userLabel(names, workerId);
      return {
        lotBarn: `${lot.code} / ${lot.barn.name}`,
        ageWeeks: String(Math.floor(ageDays / 7)),
        dead: fmtQty(deadToday),
        live: fmtQty(balance.liveBirds),
        intact: fmtQty(intact),
        defects: fmtQty(defects),
        total: fmtQty(total),
        prodPct: fmtPct(prodPct),
        idealPct: fmtPct(ideal?.layRatePct ?? null),
        water: manejo?.waterLiters != null ? fmtQty(n(manejo.waterLiters), 1) : '',
        feed: feed ? fmtQty(n(feed.consumedKg), 3) : '',
        lineage: lot.breedLineage.name,
        worker: worker ?? '',
      };
    });

    while (rows.length < 8) rows.push({ ...EMPTY_ROW });

    const health: ManejoHealthRow[] = [];
    for (const lot of scoped) {
      const manejo = lot.manejoRecords[0];
      const events = lot.healthEvents.filter(
        (ev) => calendarDayKeyInTz(ev.appliedAt) === dayKey,
      );
      const eventText = events
        .map((ev) => {
          const dose = ev.doseMl != null ? ` ${n(ev.doseMl).toLocaleString('pt-BR')} ml` : '';
          const notes = ev.notes?.trim() ? ` — ${ev.notes.trim()}` : '';
          return `${ev.productName}${dose}${notes}`;
        })
        .filter(Boolean)
        .join('; ');
      const signs = manejo?.clinicalSigns?.trim() ?? '';
      const treatment = manejo?.treatmentDescription?.trim() || eventText;
      const guidance = manejo?.technicalGuidance?.trim() ?? '';
      if (!signs && !treatment && !guidance) continue;
      const where = `${lot.code} / ${lot.barn.name}`;
      health.push({
        signs: signs ? `${where}: ${signs}` : where,
        treatment,
        guidance,
      });
    }
    while (health.length < 5) health.push({ signs: '', treatment: '', guidance: '' });

    const [dd, mm, yyyy] = [dayKey.slice(8, 10), dayKey.slice(5, 7), dayKey.slice(0, 4)];
    const responsibleVet = await prisma.veterinarian.findFirst({
      where: { isActive: true, isResponsible: true },
      orderBy: { updatedAt: 'desc' },
    });
    const logoDataUrl = await readCompanyLogoDataUrl(user.tenantSlug);
    const vet = [
      responsibleVet?.name?.trim() || company?.veterinarianName?.trim(),
      responsibleVet?.crmv?.trim() || company?.veterinarianCrmv?.trim(),
    ]
      .filter(Boolean)
      .join(' — ');

    return {
      companyName: company?.tradeName?.trim() || company?.legalName?.trim() || 'Granja',
      logoDataUrl,
      dateLabel: `${dd} / ${mm} / ${yyyy}`,
      veterinarian: vet,
      rows,
      health,
    };
  }
}
