import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantProvisioningStatus } from '../generated/central-client';
import {
  AlertStatus,
  AlertType,
  FlockLotStatus,
  OccurrencePriority,
  OccurrenceStatus,
  OperationSettings,
} from '../generated/tenant-client';
import { CentralPrismaService } from '../prisma/central-prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { computeFlockBalance } from '../production/flock-balance.util';
import { ageDaysAt, standardAt } from '../production/lay-standard.util';
import { loadOperationSettings } from './operation-settings.service';

type Client = Awaited<ReturnType<TenantPrismaService['getClient']>>;

const PRIORITY_ORDER: Record<OccurrencePriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function fmtDate(d: Date) {
  return isoDate(d).split('-').reverse().join('/');
}

/**
 * Alertas operacionais (postura abaixo do padrão, variação de ração, pendências,
 * ocorrências abertas, perdas e mortalidade acima do limite), com critério,
 * prioridade e responsável (do galpão). Idempotente por (type, referenceId) aberto.
 */
@Injectable()
export class OperationAlertsService {
  private readonly logger = new Logger(OperationAlertsService.name);

  constructor(
    private readonly central: CentralPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async scanAllTenants() {
    const tenants = await this.central.tenant.findMany({
      where: { provisioningStatus: TenantProvisioningStatus.READY },
      select: { slug: true },
    });
    for (const t of tenants) {
      try {
        await this.scanTenant(t.slug);
      } catch (e) {
        this.logger.warn(`Operation alert scan failed for ${t.slug}: ${(e as Error).message}`);
      }
    }
  }

  private async raise(
    prisma: Client,
    data: {
      type: AlertType;
      referenceId: string;
      title: string;
      message: string;
      criteria: string;
      priority: OccurrencePriority;
      barnId?: string | null;
      flockLotId?: string | null;
      assigneeUserId?: string | null;
      dueAt?: Date | null;
    },
  ) {
    const exists = await prisma.alert.findFirst({
      where: { type: data.type, referenceId: data.referenceId, status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] } },
      select: { id: true },
    });
    if (exists) return false;
    await prisma.alert.create({
      data: {
        type: data.type,
        title: data.title,
        message: data.message,
        criteria: data.criteria,
        priority: data.priority,
        referenceId: data.referenceId,
        barnId: data.barnId ?? undefined,
        flockLotId: data.flockLotId ?? undefined,
        assigneeUserId: data.assigneeUserId ?? undefined,
        dueAt: data.dueAt ?? undefined,
      },
    });
    return true;
  }

  async scanTenant(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const settings = await loadOperationSettings(prisma);
    const now = new Date();
    const today = new Date(isoDate(now));
    const yesterday = new Date(today.getTime() - 86400000);
    let created = 0;

    const lots = await prisma.flockLot.findMany({
      where: { status: FlockLotStatus.ACTIVE, housingDate: { lte: today } },
      include: {
        barn: { select: { id: true, code: true, name: true, responsibleUserId: true } },
        breedLineage: { select: { standardPoints: true } },
        movements: { select: { type: true, quantity: true } },
      },
    });
    if (!lots.length) return { created };
    const lotIds = lots.map((l) => l.id);
    const since = new Date(today.getTime() - 10 * 86400000);

    const [eggs, morts, feeds, mortTotals] = await Promise.all([
      prisma.dailyEggProduction.findMany({ where: { flockLotId: { in: lotIds }, date: { gte: since } }, orderBy: { date: 'desc' } }),
      prisma.dailyMortality.findMany({ where: { flockLotId: { in: lotIds }, date: { gte: since } } }),
      prisma.dailyFeedConsumption.findMany({ where: { flockLotId: { in: lotIds }, date: { gte: since } }, orderBy: { date: 'desc' } }),
      prisma.dailyMortality.groupBy({ by: ['flockLotId'], where: { flockLotId: { in: lotIds } }, _sum: { quantity: true } }),
    ]);
    const mortTotal = new Map(mortTotals.map((m) => [m.flockLotId, m._sum.quantity ?? 0]));

    for (const lot of lots) {
      const live = computeFlockBalance(lot.housedQty, lot.movements, mortTotal.get(lot.id) ?? 0).liveBirds;
      const label = `${lot.barn.name} · lote ${lot.code}`;
      const base = { barnId: lot.barnId, flockLotId: lot.id, assigneeUserId: lot.barn.responsibleUserId };
      const lotEggs = eggs.filter((e) => e.flockLotId === lot.id);
      const lotFeeds = feeds.filter((f) => f.flockLotId === lot.id);
      const lastEgg = lotEggs[0];

      // 1) Postura abaixo do padrão
      if (settings.enableProductionBelowStandard && lastEgg && live > 0) {
        const commercial = lastEgg.extra + lastEgg.large + lastEgg.medium + lastEgg.small;
        const lay = (commercial / live) * 100;
        const std = standardAt(lot.breedLineage.standardPoints, ageDaysAt(lot.housingDate, lastEgg.date));
        const limit = Number(settings.productionBelowStandardPct);
        if (std && std.layRatePct - lay > limit) {
          if (
            await this.raise(prisma, {
              ...base,
              type: AlertType.PRODUCTION_BELOW_STANDARD,
              referenceId: `${lot.id}:${isoDate(lastEgg.date)}`,
              title: 'Postura abaixo do padrão',
              message: `${label}: ${lay.toFixed(1)}% em ${fmtDate(lastEgg.date)} (padrão ${std.layRatePct.toFixed(1)}%)`,
              criteria: `postura ${lay.toFixed(1)}% < padrão ${std.layRatePct.toFixed(1)}% − ${limit} p.p.`,
              priority: std.layRatePct - lay > limit * 2 ? OccurrencePriority.CRITICAL : OccurrencePriority.HIGH,
            })
          )
            created++;
        }
      }

      // 2) Perdas de ovos acima do limite
      if (settings.enableLossAboveLimit && lastEgg) {
        const produced =
          lastEgg.extra + lastEgg.large + lastEgg.medium + lastEgg.small + lastEgg.cracked + lastEgg.dirty + lastEgg.deformed + lastEgg.discard;
        const loss = lastEgg.cracked + lastEgg.dirty + lastEgg.deformed + lastEgg.discard;
        const pct = produced > 0 ? (loss / produced) * 100 : 0;
        const limit = Number(settings.lossAboveLimitPct);
        if (produced > 0 && pct > limit) {
          if (
            await this.raise(prisma, {
              ...base,
              type: AlertType.LOSS_ABOVE_LIMIT,
              referenceId: `${lot.id}:${isoDate(lastEgg.date)}`,
              title: 'Perdas de ovos acima do limite',
              message: `${label}: ${pct.toFixed(1)}% de perdas em ${fmtDate(lastEgg.date)} (${loss} de ${produced})`,
              criteria: `perdas ${pct.toFixed(1)}% > limite ${limit}%`,
              priority: pct > limit * 2 ? OccurrencePriority.HIGH : OccurrencePriority.MEDIUM,
            })
          )
            created++;
        }
      }

      // 3) Variação de ração vs média dos 7 dias anteriores
      if (settings.enableFeedVariation && lotFeeds.length >= 3) {
        const [last, ...prev] = lotFeeds;
        const window = prev.slice(0, 7);
        const avg = window.reduce((s, f) => s + Number(f.consumedKg), 0) / window.length;
        const cur = Number(last.consumedKg);
        const variation = avg > 0 ? ((cur - avg) / avg) * 100 : 0;
        const limit = Number(settings.feedVariationPct);
        if (avg > 0 && Math.abs(variation) > limit) {
          if (
            await this.raise(prisma, {
              ...base,
              type: AlertType.FEED_VARIATION,
              referenceId: `${lot.id}:${isoDate(last.date)}`,
              title: variation > 0 ? 'Consumo de ração acima do normal' : 'Consumo de ração abaixo do normal',
              message: `${label}: ${cur.toFixed(1)} kg em ${fmtDate(last.date)} vs média ${avg.toFixed(1)} kg (${variation > 0 ? '+' : ''}${variation.toFixed(0)}%)`,
              criteria: `|variação| ${Math.abs(variation).toFixed(0)}% > limite ${limit}%`,
              priority: OccurrencePriority.MEDIUM,
            })
          )
            created++;
        }
      }

      // 4) Mortalidade diária acima do limite (ontem)
      if (settings.enableMortalityAboveLimit && live > 0) {
        const yMort = morts
          .filter((m) => m.flockLotId === lot.id && isoDate(m.date) === isoDate(yesterday))
          .reduce((s, m) => s + m.quantity, 0);
        const pct = (yMort / live) * 100;
        const limit = Number(settings.mortalityDailyLimitPct);
        if (yMort > 0 && pct > limit) {
          if (
            await this.raise(prisma, {
              ...base,
              type: AlertType.MORTALITY_ABOVE_LIMIT,
              referenceId: `${lot.id}:${isoDate(yesterday)}`,
              title: 'Mortalidade acima do limite',
              message: `${label}: ${yMort} ave(s) em ${fmtDate(yesterday)} (${pct.toFixed(2)}% das ${live} vivas)`,
              criteria: `mortalidade ${pct.toFixed(2)}% > limite ${limit}%`,
              priority: pct > limit * 3 ? OccurrencePriority.CRITICAL : OccurrencePriority.HIGH,
            })
          )
            created++;
        }
      }

      // 5) Lançamentos do dia anterior faltando (após a hora configurada)
      if (settings.enablePendingRecords && now.getHours() >= settings.pendingRecordsAfterHour && lot.housingDate <= yesterday) {
        const missing: string[] = [];
        if (!lotEggs.some((e) => isoDate(e.date) === isoDate(yesterday))) missing.push('postura');
        if (!lotFeeds.some((f) => isoDate(f.date) === isoDate(yesterday))) missing.push('ração');
        if (missing.length) {
          if (
            await this.raise(prisma, {
              ...base,
              type: AlertType.PENDING_RECORDS,
              referenceId: `${lot.id}:${isoDate(yesterday)}`,
              title: 'Lançamento diário pendente',
              message: `${label}: sem ${missing.join(' e ')} em ${fmtDate(yesterday)}`,
              criteria: `sem registro até ${settings.pendingRecordsAfterHour}h do dia seguinte`,
              priority: OccurrencePriority.MEDIUM,
              dueAt: today,
            })
          )
            created++;
        }
      }
    }

    // 6) Ocorrências abertas sem tratamento
    if (settings.enableOpenOccurrence) {
      const cutoff = new Date(now.getTime() - settings.openOccurrenceMaxHours * 3600000);
      const open = await prisma.operationalOccurrence.findMany({
        where: { status: { in: [OccurrenceStatus.OPEN, OccurrenceStatus.IN_PROGRESS] }, occurredAt: { lte: cutoff } },
        include: { barn: { select: { name: true, responsibleUserId: true } }, flockLot: { select: { code: true } } },
      });
      for (const o of open) {
        if (PRIORITY_ORDER[o.priority] < PRIORITY_ORDER[settings.openOccurrenceMinPriority]) continue;
        const hours = Math.floor((now.getTime() - o.occurredAt.getTime()) / 3600000);
        if (
          await this.raise(prisma, {
            type: AlertType.OPEN_OCCURRENCE,
            referenceId: o.id,
            title: 'Ocorrência sem tratamento',
            message: `${o.barn?.name ?? 'Geral'}${o.flockLot ? ` · lote ${o.flockLot.code}` : ''}: ${o.description} (há ${hours}h)`,
            criteria: `prioridade ${o.priority} ≥ ${settings.openOccurrenceMinPriority}, aberta > ${settings.openOccurrenceMaxHours}h`,
            priority: o.priority,
            barnId: o.barnId,
            flockLotId: o.flockLotId,
            assigneeUserId: o.barn?.responsibleUserId ?? null,
          })
        )
          created++;
      }
    }

    return { created };
  }

  /** Fecha alertas de ocorrência quando a ocorrência é resolvida/cancelada. */
  async resolveStaleOccurrenceAlerts(prisma: Client) {
    const alerts = await prisma.alert.findMany({
      where: { type: AlertType.OPEN_OCCURRENCE, status: { in: [AlertStatus.OPEN, AlertStatus.ACKNOWLEDGED] } },
      select: { id: true, referenceId: true },
    });
    if (!alerts.length) return 0;
    const ids = alerts.map((a) => a.referenceId).filter((v): v is string => !!v);
    const closed = await prisma.operationalOccurrence.findMany({
      where: { id: { in: ids }, status: { in: [OccurrenceStatus.RESOLVED, OccurrenceStatus.CANCELLED] } },
      select: { id: true },
    });
    const closedIds = new Set(closed.map((c) => c.id));
    const toResolve = alerts.filter((a) => a.referenceId && closedIds.has(a.referenceId)).map((a) => a.id);
    if (!toResolve.length) return 0;
    await prisma.alert.updateMany({
      where: { id: { in: toResolve } },
      data: { status: AlertStatus.RESOLVED, resolvedAt: new Date() },
    });
    return toResolve.length;
  }
}

export type { OperationSettings };
