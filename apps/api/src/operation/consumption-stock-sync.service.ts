import { Injectable, Logger } from '@nestjs/common';
import { defaultStockChartAccountId } from '../finance/chart-account-defaults';
import {
  ConsumptionSyncMode,
  OperationRecordStatus,
  StockMovementType,
} from '../generated/tenant-client';
import { averageCostByProduct } from '../inventory/product-cost.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { loadOperationSettings } from './operation-settings.service';

type Client = Awaited<ReturnType<TenantPrismaService['getClient']>>;

export const FEED_CONSUMPTION_REF = 'consumo:racao:';
export const SUPPLY_CONSUMPTION_REF = 'consumo:insumo:';

/**
 * Baixa idempotente de ração/insumos no estoque (padrão do ledger da postura):
 * calcula a quantidade que deveria estar baixada para o registro e aplica só o delta
 * em relação ao que já foi sincronizado (`stockSyncedKg` / `stockSyncedQty`).
 */
@Injectable()
export class ConsumptionStockSyncService {
  private readonly logger = new Logger(ConsumptionStockSyncService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private shouldSync(mode: ConsumptionSyncMode, status: OperationRecordStatus) {
    if (mode === ConsumptionSyncMode.OFF) return false;
    if (mode === ConsumptionSyncMode.ON_RECORD) return true;
    return status === OperationRecordStatus.REVIEWED || status === OperationRecordStatus.ADJUSTED;
  }

  private async chartAccountId(prisma: Client, configured: string | null) {
    if (configured) {
      const acc = await prisma.chartAccount.findUnique({ where: { id: configured } });
      if (acc) return acc.id;
    }
    return defaultStockChartAccountId(prisma);
  }

  private async averageCost(prisma: Client, productId: string) {
    const moves = await prisma.stockMovement.findMany({
      where: { productId },
      orderBy: [{ movedAt: 'asc' }, { id: 'asc' }],
      select: { productId: true, type: true, quantity: true, unitCost: true },
    });
    const avg = averageCostByProduct(moves).get(productId)?.averageCost ?? 0;
    return avg > 0 ? avg : null;
  }

  private async applyDelta(
    prisma: Client,
    opts: {
      productId: string;
      stockLocationId: string | null;
      chartAccountId: string;
      delta: number;
      reference: string;
      movedAt: Date;
    },
  ) {
    if (Math.abs(opts.delta) < 0.0005) return;
    const type = opts.delta > 0 ? StockMovementType.OUT : StockMovementType.IN;
    const unitCost = await this.averageCost(prisma, opts.productId);
    await prisma.stockMovement.create({
      data: {
        productId: opts.productId,
        chartAccountId: opts.chartAccountId,
        stockLocationId: opts.stockLocationId ?? undefined,
        type,
        quantity: Math.abs(opts.delta),
        unitCost: unitCost ?? undefined,
        reference: opts.reference,
        movedAt: opts.movedAt,
      },
    });
  }

  /** Sincroniza o consumo de ração de um registro diário com o estoque. */
  async syncFeed(tenantSlug: string, feedId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const row = await prisma.dailyFeedConsumption.findUnique({ where: { id: feedId } });
    if (!row) return;
    const settings = await loadOperationSettings(prisma);
    const target =
      row.productId && this.shouldSync(settings.consumptionSyncMode, row.status) ? Number(row.consumedKg) : 0;
    const synced = Number(row.stockSyncedKg);
    const delta = target - synced;
    if (Math.abs(delta) < 0.0005) return;
    // sem produto e nada sincronizado: nada a fazer
    const productId = row.productId;
    if (!productId) return;
    try {
      const chartAccountId = await this.chartAccountId(prisma, settings.stockChartAccountId);
      await this.applyDelta(prisma, {
        productId,
        stockLocationId: row.stockLocationId,
        chartAccountId,
        delta,
        reference: `${FEED_CONSUMPTION_REF}${row.id}`,
        movedAt: new Date(`${row.date.toISOString().slice(0, 10)}T12:00:00.000Z`),
      });
      await prisma.dailyFeedConsumption.update({ where: { id: row.id }, data: { stockSyncedKg: target } });
    } catch (e) {
      this.logger.warn(`Feed stock sync (${feedId}): ${(e as Error).message}`);
    }
  }

  /** Sincroniza um consumo/perda de insumo com o estoque. */
  async syncSupply(tenantSlug: string, supplyId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const row = await prisma.supplyConsumption.findUnique({ where: { id: supplyId } });
    if (!row) return;
    const settings = await loadOperationSettings(prisma);
    // RETURN devolve ao estoque (delta negativo => IN); TRANSFER não movimenta saldo global.
    const sign = row.kind === 'RETURN' ? -1 : row.kind === 'TRANSFER' ? 0 : 1;
    const target = this.shouldSync(settings.consumptionSyncMode, row.status) ? sign * Number(row.quantity) : 0;
    const synced = Number(row.stockSyncedQty);
    const delta = target - synced;
    if (Math.abs(delta) < 0.0005) return;
    try {
      const chartAccountId = await this.chartAccountId(prisma, settings.stockChartAccountId);
      await this.applyDelta(prisma, {
        productId: row.productId,
        stockLocationId: row.stockLocationId,
        chartAccountId,
        delta,
        reference: `${SUPPLY_CONSUMPTION_REF}${row.id}`,
        movedAt: new Date(`${row.date.toISOString().slice(0, 10)}T12:00:00.000Z`),
      });
      await prisma.supplyConsumption.update({ where: { id: row.id }, data: { stockSyncedQty: target } });
    } catch (e) {
      this.logger.warn(`Supply stock sync (${supplyId}): ${(e as Error).message}`);
    }
  }

  /** Reverte integralmente a baixa de um registro de ração (usar antes de trocar o produto). */
  async unsyncFeed(tenantSlug: string, feedId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const row = await prisma.dailyFeedConsumption.findUnique({ where: { id: feedId } });
    if (!row || !row.productId) return;
    const synced = Number(row.stockSyncedKg);
    if (Math.abs(synced) < 0.0005) return;
    const settings = await loadOperationSettings(prisma);
    const chartAccountId = await this.chartAccountId(prisma, settings.stockChartAccountId);
    await this.applyDelta(prisma, {
      productId: row.productId,
      stockLocationId: row.stockLocationId,
      chartAccountId,
      delta: -synced,
      reference: `${FEED_CONSUMPTION_REF}${row.id}`,
      movedAt: new Date(),
    });
    await prisma.dailyFeedConsumption.update({ where: { id: row.id }, data: { stockSyncedKg: 0 } });
  }

  /** Reverte integralmente a baixa de um consumo de insumo (usar antes de trocar o produto). */
  async unsyncSupply(tenantSlug: string, supplyId: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const row = await prisma.supplyConsumption.findUnique({ where: { id: supplyId } });
    if (!row) return;
    const synced = Number(row.stockSyncedQty);
    if (Math.abs(synced) < 0.0005) return;
    const settings = await loadOperationSettings(prisma);
    const chartAccountId = await this.chartAccountId(prisma, settings.stockChartAccountId);
    await this.applyDelta(prisma, {
      productId: row.productId,
      stockLocationId: row.stockLocationId,
      chartAccountId,
      delta: -synced,
      reference: `${SUPPLY_CONSUMPTION_REF}${row.id}`,
      movedAt: new Date(),
    });
    await prisma.supplyConsumption.update({ where: { id: row.id }, data: { stockSyncedQty: 0 } });
  }

  /** Reprocessa todos os registros (útil ao mudar o modo de sincronização). */
  async resyncAll(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const feeds = await prisma.dailyFeedConsumption.findMany({
      where: { OR: [{ productId: { not: null } }, { stockSyncedKg: { not: 0 } }] },
      select: { id: true },
    });
    for (const f of feeds) await this.syncFeed(tenantSlug, f.id);
    const supplies = await prisma.supplyConsumption.findMany({ select: { id: true } });
    for (const s of supplies) await this.syncSupply(tenantSlug, s.id);
    return { feeds: feeds.length, supplies: supplies.length };
  }
}
