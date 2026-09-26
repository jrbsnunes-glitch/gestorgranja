import { Injectable } from '@nestjs/common';
import { ConsumptionSyncMode, OccurrencePriority, OperationSettings } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type OperationSettingsPatch = Partial<{
  consumptionSyncMode: ConsumptionSyncMode;
  eggSyncOnlyReviewed: boolean;
  stockChartAccountId: string | null;
  enableProductionBelowStandard: boolean;
  productionBelowStandardPct: number;
  enableFeedVariation: boolean;
  feedVariationPct: number;
  enablePendingRecords: boolean;
  pendingRecordsAfterHour: number;
  enableOpenOccurrence: boolean;
  openOccurrenceMinPriority: OccurrencePriority;
  openOccurrenceMaxHours: number;
  enableLossAboveLimit: boolean;
  lossAboveLimitPct: number;
  enableMortalityAboveLimit: boolean;
  mortalityDailyLimitPct: number;
}>;

type Client = Awaited<ReturnType<TenantPrismaService['getClient']>>;

/** Lê (criando se necessário) o singleton OperationSettings. Utilitário sem DI para uso em outros módulos. */
export async function loadOperationSettings(prisma: Client): Promise<OperationSettings> {
  const cfg = await prisma.operationSettings.findUnique({ where: { id: 'default' } });
  if (cfg) return cfg;
  return prisma.operationSettings.create({ data: { id: 'default' } });
}

@Injectable()
export class OperationSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async get(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    return loadOperationSettings(prisma);
  }

  async update(tenantSlug: string, patch: OperationSettingsPatch) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    await loadOperationSettings(prisma);
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) data[k] = v;
    }
    return prisma.operationSettings.update({ where: { id: 'default' }, data });
  }
}
