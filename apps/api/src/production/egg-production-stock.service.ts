import { Injectable, Logger } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { OperationRecordStatus, StockMovementType } from '../generated/tenant-client';
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
      try {
        const chartAccountId = await defaultEggStockChartAccountId(prisma);
        cfg = await prisma.eggStockConfig.update({
          where: { id: 'default' },
          data: { chartAccountId },
        });
      } catch (err) {
        this.logger.warn(
          `Integração postura: conta contábil padrão não encontrada (${tenantSlug}). Selecione manualmente no formulário.`,
        );
        this.logger.debug(String(err));
      }
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

  private movementBalance(
    moves: { type: string; quantity: { toString(): string }; reference: string | null }[],
  ) {
    let posturaIn = 0;
    let posturaOut = 0;
    let otherNet = 0;
    for (const m of moves) {
      const q = Number(m.quantity);
      const signed = m.type === 'OUT' ? -q : q;
      const ref = m.reference ?? '';
      if (ref.startsWith('postura:')) {
        if (m.type === 'OUT') posturaOut += q;
        else posturaIn += q;
      } else {
        otherNet += signed;
      }
    }
    return { posturaIn, posturaOut, posturaNet: posturaIn - posturaOut, otherNet };
  }

  /** Postura × ledger × saldo × vendas/outros movimentos. */
  async getReconciliation(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const cfg = await this.getConfig(tenantSlug);
    const op = await prisma.operationSettings.findUnique({ where: { id: 'default' } });
    const eggSyncOnlyReviewed = op?.eggSyncOnlyReviewed ?? false;

    const cfgPack = {
      eggsPerCarton: cfg.eggsPerCarton,
      cartonsPerBox: cfg.cartonsPerBox,
      syncCartons: cfg.syncCartons,
      syncBoxes: cfg.syncBoxes,
      cartonProductId: cfg.cartonProductId,
      boxProductId: cfg.boxProductId,
    };

    const production = await prisma.dailyEggProduction.findMany({
      include: { eggStockLedger: true, flockLot: { select: { code: true } } },
    });

    let totalCommercial = 0;
    let eligibleCommercial = 0;
    let expectedCartons = 0;
    let expectedBoxes = 0;
    let rowsMissingLedger = 0;

    const shouldSync = (status: OperationRecordStatus) =>
      !eggSyncOnlyReviewed ||
      status === OperationRecordStatus.REVIEWED ||
      status === OperationRecordStatus.ADJUSTED;

    for (const row of production) {
      const comm = this.commercialEggs(row);
      totalCommercial += comm;
      if (shouldSync(row.status)) {
        eligibleCommercial += comm;
        const t = productionStockTargets(comm, cfgPack);
        expectedCartons += t.targetLooseCartons;
        expectedBoxes += t.targetBoxes;
        if (!row.eggStockLedger) rowsMissingLedger += 1;
      }
    }

    const ledgerRows = await prisma.eggProductionStockLedger.findMany();
    let ledgerCartons = 0;
    let ledgerBoxes = 0;
    for (const l of ledgerRows) {
      ledgerCartons += Number(l.cartonsQty);
      ledgerBoxes += Number(l.boxesQty);
    }

    const loadAllMoves = async (productId: string | null) => {
      if (!productId) return [];
      return prisma.stockMovement.findMany({
        where: { productId },
        select: { type: true, quantity: true, reference: true, movedAt: true },
      });
    };

    const cartonMoves = await loadAllMoves(cfg.cartonProductId);
    const boxMoves = await loadAllMoves(cfg.boxProductId);

    const cartonBal = cartonMoves.reduce((b, m) => {
      const q = Number(m.quantity);
      return b + (m.type === 'OUT' ? -q : q);
    }, 0);
    const boxBal = boxMoves.reduce((b, m) => {
      const q = Number(m.quantity);
      return b + (m.type === 'OUT' ? -q : q);
    }, 0);

    const cartonSplit = this.movementBalance(cartonMoves);
    const boxSplit = this.movementBalance(boxMoves);

    const eggsPerCarton = Math.max(cfg.eggsPerCarton, 1);
    const cartonsPerBox = Math.max(cfg.cartonsPerBox, 1);
    const eggsPerBox = eggsPerCarton * cartonsPerBox;

    const equiv = (cartons: number, boxes: number) =>
      boxes * cartonsPerBox * eggsPerCarton + cartons * eggsPerCarton;

    const eps = 0.001;
    const stockMatchesLedger =
      Math.abs(cartonBal - ledgerCartons) < eps && Math.abs(boxBal - ledgerBoxes) < eps;
    const ledgerMatchesProduction =
      Math.abs(ledgerCartons - expectedCartons) < eps &&
      Math.abs(ledgerBoxes - expectedBoxes) < eps;
    const posturaMatchesLedger =
      Math.abs(cartonSplit.posturaNet - ledgerCartons) < eps &&
      Math.abs(boxSplit.posturaNet - ledgerBoxes) < eps;

    const formatOtherMove = (m: {
      type: string;
      quantity: { toString(): string };
      reference: string | null;
      movedAt: Date;
    }) => {
      const ref = m.reference ?? '';
      let kind = 'Outro';
      if (ref.startsWith('venda:')) kind = 'Venda';
      else if (ref.startsWith('postura:')) kind = 'Postura';
      return {
        at: m.movedAt.toISOString(),
        kind,
        type: m.type,
        qty: Number(m.quantity),
        reference: ref || null,
      };
    };

    const otherMovesSample = [...cartonMoves, ...boxMoves]
      .filter((m) => !(m.reference ?? '').startsWith('postura:'))
      .sort((a, b) => b.movedAt.getTime() - a.movedAt.getTime())
      .slice(0, 12)
      .map(formatOtherMove);

    const [cartonProduct, boxProduct] = await Promise.all([
      cfg.cartonProductId
        ? prisma.product.findUnique({
            where: { id: cfg.cartonProductId },
            select: { sku: true, name: true },
          })
        : null,
      cfg.boxProductId
        ? prisma.product.findUnique({
            where: { id: cfg.boxProductId },
            select: { sku: true, name: true },
          })
        : null,
    ]);

    return {
      config: {
        enabled: cfg.enabled,
        eggsPerCarton: cfg.eggsPerCarton,
        cartonsPerBox: cfg.cartonsPerBox,
        syncCartons: cfg.syncCartons,
        syncBoxes: cfg.syncBoxes,
        eggSyncOnlyReviewed,
        cartonProduct,
        boxProduct,
        costPerCommercialEgg:
          cfg.costPerCommercialEgg != null ? Number(cfg.costPerCommercialEgg) : null,
      },
      production: {
        rows: production.length,
        totalCommercialEggs: totalCommercial,
        eligibleCommercialEggs: eligibleCommercial,
        rowsMissingLedger,
        unpackagedRemainderEggs: Math.max(
          0,
          eligibleCommercial - equiv(expectedCartons, expectedBoxes),
        ),
      },
      fromProduction: {
        looseCartons: expectedCartons,
        boxes: expectedBoxes,
        equivalentEggs: equiv(expectedCartons, expectedBoxes),
      },
      ledger: {
        looseCartons: ledgerCartons,
        boxes: ledgerBoxes,
        equivalentEggs: equiv(ledgerCartons, ledgerBoxes),
      },
      currentStock: {
        looseCartons: cartonBal,
        boxes: boxBal,
        equivalentEggs: equiv(cartonBal, boxBal),
      },
      posturaNet: {
        cartons: cartonSplit.posturaNet,
        boxes: boxSplit.posturaNet,
      },
      otherNet: {
        cartons: cartonSplit.otherNet,
        boxes: boxSplit.otherNet,
        equivalentEggs: equiv(cartonSplit.otherNet, boxSplit.otherNet),
      },
      checks: {
        ledgerMatchesProduction,
        posturaNetMatchesLedger: posturaMatchesLedger,
        stockMatchesLedger,
        integrationHealthy:
          cfg.enabled &&
          ledgerMatchesProduction &&
          posturaMatchesLedger &&
          rowsMissingLedger === 0,
        stockMatchesProductionTargets:
          Math.abs(cartonBal - expectedCartons) < eps && Math.abs(boxBal - expectedBoxes) < eps,
      },
      otherMovesSample,
      eggsPerCarton,
      cartonsPerBox,
      eggsPerBox,
    };
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
