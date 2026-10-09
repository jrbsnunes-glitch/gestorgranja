/**
 * Auditoria estoque de ovos (cartelas/caixas/unidades) vs postura e config.
 * Uso: dotenv -e ../../.env -- tsx scripts/audit-egg-stock.ts [tenantSlug]
 */
import { PrismaClient as CentralClient } from '../src/generated/central-client';
import { PrismaClient as TenantClient, OperationRecordStatus } from '../src/generated/tenant-client';
import { productionStockTargets } from '../src/inventory/egg-packaging.util';

async function tenantUrlForSlug(slug: string) {
  const centralUrl = process.env.CENTRAL_DATABASE_URL;
  const template = process.env.TENANT_DATABASE_URL;
  if (!centralUrl || !template) throw new Error('CENTRAL_DATABASE_URL e TENANT_DATABASE_URL');
  const central = new CentralClient({ datasources: { db: { url: centralUrl } } });
  const tenant = await central.tenant.findUnique({ where: { slug } });
  await central.$disconnect();
  if (!tenant) throw new Error(`Tenant ${slug} não encontrado`);
  return template.replace(/\/[^/]+$/, `/${tenant.databaseName}`);
}

function commercialEggs(row: {
  extra: number;
  large: number;
  medium: number;
  small: number;
}) {
  return row.extra + row.large + row.medium + row.small;
}

async function balanceFor(prisma: TenantClient, productId: string | null) {
  if (!productId) return 0;
  const moves = await prisma.stockMovement.findMany({ where: { productId } });
  let balance = 0;
  for (const m of moves) {
    const q = Number(m.quantity);
    balance += m.type === 'OUT' ? -q : q;
  }
  return balance;
}

async function posturaNet(prisma: TenantClient, productId: string | null) {
  if (!productId) return { in: 0, out: 0, net: 0, other: 0 };
  const moves = await prisma.stockMovement.findMany({ where: { productId } });
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
  return { in: posturaIn, out: posturaOut, net: posturaIn - posturaOut, other: otherNet };
}

function shouldSyncRow(
  eggSyncOnlyReviewed: boolean,
  status: OperationRecordStatus,
): boolean {
  if (!eggSyncOnlyReviewed) return true;
  return (
    status === OperationRecordStatus.REVIEWED || status === OperationRecordStatus.ADJUSTED
  );
}

async function main() {
  const slug = process.argv[2] ?? 'demo';
  const url = await tenantUrlForSlug(slug);
  const prisma = new TenantClient({ datasources: { db: { url } } });

  try {
    const cfg = await prisma.eggStockConfig.findUnique({ where: { id: 'default' } });
    const op = await prisma.operationSettings.findUnique({ where: { id: 'default' } });
    const eggSyncOnlyReviewed = op?.eggSyncOnlyReviewed ?? false;

    const production = await prisma.dailyEggProduction.findMany({
      orderBy: [{ date: 'asc' }, { flockLotId: 'asc' }],
      include: { eggStockLedger: true, flockLot: { select: { code: true } } },
    });

    const ledgerRows = await prisma.eggProductionStockLedger.findMany();

    let totalCommercial = 0;
    let eligibleCommercial = 0;
    let expectedCartonsFromProd = 0;
    let expectedBoxesFromProd = 0;
    let missingLedger = 0;
    const unsynced: { date: string; lot: string; commercial: number; status: string }[] = [];

    const cfgPack = {
      eggsPerCarton: cfg?.eggsPerCarton ?? 30,
      cartonsPerBox: cfg?.cartonsPerBox ?? 12,
      syncCartons: cfg?.syncCartons ?? true,
      syncBoxes: cfg?.syncBoxes ?? true,
      cartonProductId: cfg?.cartonProductId ?? null,
      boxProductId: cfg?.boxProductId ?? null,
    };

    for (const row of production) {
      const comm = commercialEggs(row);
      totalCommercial += comm;
      const eligible = shouldSyncRow(eggSyncOnlyReviewed, row.status);
      if (eligible) {
        eligibleCommercial += comm;
        const t = productionStockTargets(comm, cfgPack);
        expectedCartonsFromProd += t.targetLooseCartons;
        expectedBoxesFromProd += t.targetBoxes;
        if (!row.eggStockLedger) {
          missingLedger += 1;
          unsynced.push({
            date: row.date.toISOString().slice(0, 10),
            lot: row.flockLot.code,
            commercial: comm,
            status: row.status,
          });
        }
      }
    }

    let ledgerCartons = 0;
    let ledgerBoxes = 0;
    let ledgerCommercial = 0;
    for (const l of ledgerRows) {
      ledgerCartons += Number(l.cartonsQty);
      ledgerBoxes += Number(l.boxesQty);
      ledgerCommercial += l.commercialEggs;
    }

    const cartonBal = await balanceFor(prisma, cfg?.cartonProductId ?? null);
    const boxBal = await balanceFor(prisma, cfg?.boxProductId ?? null);
    const eggsPerCarton = Math.max(cfgPack.eggsPerCarton, 1);
    const cartonsPerBox = Math.max(cfgPack.cartonsPerBox, 1);
    const totalEggsEquiv = boxBal * eggsPerCarton * cartonsPerBox + cartonBal * eggsPerCarton;

    const cartonPostura = await posturaNet(prisma, cfg?.cartonProductId ?? null);
    const boxPostura = await posturaNet(prisma, cfg?.boxProductId ?? null);

    const cartonProduct = cfg?.cartonProductId
      ? await prisma.product.findUnique({ where: { id: cfg.cartonProductId }, select: { sku: true, name: true } })
      : null;
    const boxProduct = cfg?.boxProductId
      ? await prisma.product.findUnique({ where: { id: cfg.boxProductId }, select: { sku: true, name: true } })
      : null;

    const eps = 0.001;
    const cartonsMatchLedger = Math.abs(cartonBal - ledgerCartons) < eps;
    const boxesMatchLedger = Math.abs(boxBal - ledgerBoxes) < eps;
    const ledgerMatchProd =
      Math.abs(ledgerCartons - expectedCartonsFromProd) < eps &&
      Math.abs(ledgerBoxes - expectedBoxesFromProd) < eps;
    const posturaMatchLedger =
      Math.abs(cartonPostura.net - ledgerCartons) < eps && Math.abs(boxPostura.net - ledgerBoxes) < eps;

    const eggsFromLedger =
      ledgerBoxes * eggsPerCarton * cartonsPerBox + ledgerCartons * eggsPerCarton;
    const eggsFromEligibleProd =
      expectedBoxesFromProd * eggsPerCarton * cartonsPerBox + expectedCartonsFromProd * eggsPerCarton;

    const movementDetail: unknown[] = [];
    for (const pid of [cfg?.cartonProductId, cfg?.boxProductId].filter(Boolean) as string[]) {
      const prod = await prisma.product.findUnique({ where: { id: pid }, select: { sku: true, name: true } });
      const moves = await prisma.stockMovement.findMany({
        where: { productId: pid },
        orderBy: { movedAt: 'asc' },
        select: { movedAt: true, type: true, quantity: true, reference: true },
      });
      movementDetail.push({
        product: prod,
        moves: moves.map((m) => ({
          at: m.movedAt.toISOString(),
          type: m.type,
          qty: Number(m.quantity),
          reference: m.reference,
        })),
      });
    }

    console.log(JSON.stringify({
      tenant: slug,
      config: {
        enabled: cfg?.enabled ?? false,
        eggsPerCarton: cfgPack.eggsPerCarton,
        cartonsPerBox: cfgPack.cartonsPerBox,
        syncCartons: cfgPack.syncCartons,
        syncBoxes: cfgPack.syncBoxes,
        cartonProduct: cartonProduct ? `${cartonProduct.sku} — ${cartonProduct.name}` : null,
        boxProduct: boxProduct ? `${boxProduct.sku} — ${boxProduct.name}` : null,
        chartAccountId: cfg?.chartAccountId ?? null,
        costPerCommercialEgg: cfg?.costPerCommercialEgg != null ? Number(cfg.costPerCommercialEgg) : null,
      },
      operationSettings: { eggSyncOnlyReviewed },
      production: {
        rows: production.length,
        totalCommercialEggs: totalCommercial,
        eligibleCommercialEggs: eligibleCommercial,
        rowsMissingLedger: missingLedger,
        unsyncedSample: unsynced.slice(0, 15),
      },
      expectedFromEligibleProduction: {
        looseCartons: expectedCartonsFromProd,
        boxes: expectedBoxesFromProd,
        equivalentEggs: eggsFromEligibleProd,
      },
      ledgerTotals: {
        looseCartons: ledgerCartons,
        boxes: ledgerBoxes,
        commercialEggsRecorded: ledgerCommercial,
        equivalentEggs: eggsFromLedger,
      },
      currentStock: {
        looseCartons: cartonBal,
        boxes: boxBal,
        equivalentEggs: totalEggsEquiv,
        looseCartonsUnit: 'cartela avulsa',
        boxesUnit: 'caixa',
      },
      posturaMovementsNet: {
        cartons: cartonPostura,
        boxes: boxPostura,
      },
      nonPosturaNetInStock: {
        cartons: cartonBal - cartonPostura.net,
        boxes: boxBal - boxPostura.net,
      },
      reconciliation: {
        stockCartonsMatchesLedger: cartonsMatchLedger,
        stockBoxesMatchesLedger: boxesMatchLedger,
        ledgerMatchesEligibleProduction: ledgerMatchProd,
        posturaNetMatchesLedger: posturaMatchLedger,
        overallOk:
          cartonsMatchLedger &&
          boxesMatchLedger &&
          ledgerMatchProd &&
          missingLedger === 0 &&
          (cfg?.enabled ?? false),
      },
      movementDetail,
      notes: [
        eggSyncOnlyReviewed
          ? 'Com eggSyncOnlyReviewed=true, só REVIEWED/ADJUSTED entram no esperado; registros RECORDED sem ledger são esperados até conferência.'
          : 'Postura sincroniza no registro (eggSyncOnlyReviewed=false).',
        'Cartela avulsa + caixa: equivalente em ovos = cartelas×ovos/cartela + caixas×cartelas/caixa×ovos/cartela.',
        'Movimentos fora de postura: (saldo − net postura) indica NF, vendas ou ajustes manuais.',
      ],
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
