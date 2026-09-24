import { Injectable, Logger } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { StockMovementType } from '../generated/tenant-client';
import { defaultEggStockChartAccountId } from '../finance/chart-account-defaults';
import { productionStockTargets } from '../inventory/egg-packaging.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
type EggRow = {
  id: string;
  flockLotId: string;
  date: Date;
  extra: number;
  large: number;
  medium: number;
  small: number;
};

@Injectable()
export class EggProductionStockService {
  private readonly logger = new Logger(EggProductionStockService.name);

  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private commercialEggs(row: EggRow) {
    return row.extra + row.large + row.medium + row.small;
  }

  async getConfig(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    let cfg = await prisma.eggStockConfig.findUnique({ where: { id: 'default' } });
    if (!cfg) {
      cfg = await prisma.eggStockConfig.create({ data: { id: 'default' } });
    }
    if (!cfg.chartAccountId) {
      const chartAccountId = await defaultEggStockChartAccountId(prisma);
      cfg = await prisma.eggStockConfig.update({
        where: { id: 'default' },
        data: { chartAccountId },
      });
    }
    return cfg;
  }

  async updateConfig(tenantSlug: string, data: Partial<{
    enabled: boolean;
    eggsPerCarton: number;
    cartonsPerBox: number;
    syncCartons: boolean;
    syncBoxes: boolean;
    cartonProductId: string | null;
    boxProductId: string | null;
    chartAccountId: string | null;
    costPerCommercialEgg: number | null;
  }>) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    await this.getConfig(tenantSlug);
    return prisma.eggStockConfig.update({
      where: { id: 'default' },
      data: {
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
        ...(data.eggsPerCarton !== undefined ? { eggsPerCarton: data.eggsPerCarton } : {}),
        ...(data.cartonsPerBox !== undefined ? { cartonsPerBox: data.cartonsPerBox } : {}),
        ...(data.syncCartons !== undefined ? { syncCartons: data.syncCartons } : {}),
        ...(data.syncBoxes !== undefined ? { syncBoxes: data.syncBoxes } : {}),
        ...(data.cartonProductId !== undefined ? { cartonProductId: data.cartonProductId } : {}),
        ...(data.boxProductId !== undefined ? { boxProductId: data.boxProductId } : {}),
        ...(data.chartAccountId !== undefined ? { chartAccountId: data.chartAccountId } : {}),
        ...(data.costPerCommercialEgg !== undefined
          ? { costPerCommercialEgg: data.costPerCommercialEgg }
          : {}),
      },
    });
  }

  private unitCostsFromConfig(cfg: {
    costPerCommercialEgg?: { toString(): string } | null;
    eggsPerCarton: number;
    cartonsPerBox: number;
  }) {
    const egg = cfg.costPerCommercialEgg != null ? Number(cfg.costPerCommercialEgg) : null;
    if (egg == null || !Number.isFinite(egg) || egg < 0) {
      return { carton: null as number | null, box: null as number | null };
    }
    const eggsPerCarton = Math.max(cfg.eggsPerCarton, 1);
    const cartonsPerBox = Math.max(cfg.cartonsPerBox, 1);
    const carton = egg * eggsPerCarton;
    const box = carton * cartonsPerBox;
    return { carton, box };
  }

  /** Preenche custo unitário nas movimentações geradas pela postura (sem custo). */
  async applyProductionMovementCosts(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const cfg = await this.getConfig(user.tenantSlug);
    const { carton, box } = this.unitCostsFromConfig(cfg);
    if (carton == null && box == null) {
      return { updated: 0, message: 'Informe o custo por ovo comercial na configuração.' };
    }

    let updated = 0;
    if (cfg.cartonProductId && carton != null) {
      const r = await prisma.stockMovement.updateMany({
        where: {
          productId: cfg.cartonProductId,
          type: StockMovementType.IN,
          unitCost: null,
          reference: { startsWith: 'postura:' },
        },
        data: { unitCost: carton },
      });
      updated += r.count;
    }
    if (cfg.boxProductId && box != null) {
      const r = await prisma.stockMovement.updateMany({
        where: {
          productId: cfg.boxProductId,
          type: StockMovementType.IN,
          unitCost: null,
          reference: { startsWith: 'postura:' },
        },
        data: { unitCost: box },
      });
      updated += r.count;
    }
    return { updated, cartonUnitCost: carton, boxUnitCost: box };
  }

  async syncFromProduction(user: JwtPayload, row: EggRow) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const cfg = await this.getConfig(user.tenantSlug);
    if (!cfg.enabled || !cfg.chartAccountId) return;

    const commercial = this.commercialEggs(row);
    const { targetLooseCartons, targetBoxes } = productionStockTargets(commercial, cfg);

    const ledger = await prisma.eggProductionStockLedger.findUnique({
      where: { dailyEggProductionId: row.id },
    });

    const prevLooseCartons = ledger ? Number(ledger.cartonsQty) : 0;
    const prevBoxes = ledger ? Number(ledger.boxesQty) : 0;

    const dateRef = row.date.toISOString().slice(0, 10);

    const unitCosts = this.unitCostsFromConfig(cfg);

    if (cfg.cartonProductId) {
      await this.applyDelta(prisma, {
        productId: cfg.cartonProductId,
        chartAccountId: cfg.chartAccountId,
        delta: targetLooseCartons - prevLooseCartons,
        reference: `postura:${row.flockLotId}:${dateRef}:cartela`,
        unitCost: unitCosts.carton,
      });
    }

    if (cfg.boxProductId) {
      await this.applyDelta(prisma, {
        productId: cfg.boxProductId,
        chartAccountId: cfg.chartAccountId,
        delta: targetBoxes - prevBoxes,
        reference: `postura:${row.flockLotId}:${dateRef}:caixa`,
        unitCost: unitCosts.box,
      });
    }

    await prisma.eggProductionStockLedger.upsert({
      where: { dailyEggProductionId: row.id },
      create: {
        dailyEggProductionId: row.id,
        commercialEggs: commercial,
        cartonsQty: targetLooseCartons,
        boxesQty: targetBoxes,
      },
      update: {
        commercialEggs: commercial,
        cartonsQty: targetLooseCartons,
        boxesQty: targetBoxes,
      },
    });
  }

  async inventorySnapshot(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const cfg = await this.getConfig(tenantSlug);
    const eggsPerCarton = Math.max(cfg.eggsPerCarton, 1);
    const cartonsPerBox = Math.max(cfg.cartonsPerBox, 1);
    const eggsPerBox = eggsPerCarton * cartonsPerBox;

    const balanceFor = async (productId: string | null) => {
      if (!productId) return 0;
      const moves = await prisma.stockMovement.findMany({ where: { productId } });
      let balance = 0;
      for (const m of moves) {
        const q = Number(m.quantity);
        balance += m.type === 'OUT' ? -q : q;
      }
      return balance;
    };

    const boxes = await balanceFor(cfg.boxProductId);
    const cartons = await balanceFor(cfg.cartonProductId);
    const totalEggs =
      boxes * eggsPerBox + cartons * eggsPerCarton;

    return {
      boxes,
      cartons,
      totalEggs,
      eggsPerCarton,
      cartonsPerBox,
      eggsPerBox,
    };
  }

  async resyncAllFromProduction(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.dailyEggProduction.findMany({
      orderBy: [{ date: 'asc' }, { flockLotId: 'asc' }],
    });
    for (const row of rows) {
      await this.syncFromProduction(user, row);
    }
    return { processed: rows.length };
  }

  private async applyDelta(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    opts: {
      productId: string;
      chartAccountId: string;
      delta: number;
      reference: string;
      unitCost?: number | null;
    },
  ) {
    if (opts.delta === 0) return;
    const type = opts.delta > 0 ? StockMovementType.IN : StockMovementType.OUT;
    const unitCost =
      type === StockMovementType.IN && opts.unitCost != null && Number.isFinite(opts.unitCost)
        ? opts.unitCost
        : undefined;
    await prisma.stockMovement.create({
      data: {
        productId: opts.productId,
        chartAccountId: opts.chartAccountId,
        type,
        quantity: Math.abs(opts.delta),
        reference: opts.reference,
        unitCost,
      },
    });
  }
}
