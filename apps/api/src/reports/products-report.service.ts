import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  eggProductRole,
  equivalentCartonsFromStock,
  qtyToEquivalentCartons,
  type EggPackagingLinks,
} from '../inventory/egg-packaging.util';
import { StockMovementType } from '../generated/tenant-client';
import { EggProductionStockService } from '../production/egg-production-stock.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type EggPackagingSummaryLine = { label: string; value: string };
export type EggPackagingSummaryBlock = {
  title: string;
  note?: string;
  lines: EggPackagingSummaryLine[];
};

export type ProductsReportVariant = 'geral' | 'saldo_fisico' | 'saldo_financeiro' | 'giro';

export type ProductsReportQuery = {
  variant: ProductsReportVariant;
  from?: string;
  to?: string;
  stockLocationIds?: string[];
};

type ReportRow = Record<string, string | number>;

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  FEED: 'Ração',
  MEDICATION: 'Medicamento',
  SUPPLY: 'Insumo',
  CONSTRUCTION: 'Construção',
  OFFICE: 'Escritório',
  PACKAGED_EGG: 'Ovo embalado',
};

function parseDay(raw: string | undefined, mode: 'start' | 'end'): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (mode === 'end') d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function dec(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function labelProductType(type: string) {
  return PRODUCT_TYPE_LABELS[type] ?? type;
}

function sumColumn(rows: ReportRow[], key: string): number {
  let s = 0;
  for (const row of rows) {
    const v = row[key];
    if (typeof v === 'number' && Number.isFinite(v)) s += v;
    else if (typeof v === 'string') {
      const n = Number(v.replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n)) s += n;
    }
  }
  return s;
}

function fmtQty(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPct(n: number | null) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function fmtUnitProfit(salePrice: { toString(): string } | null | undefined, avgCost: number) {
  if (salePrice == null) return '—';
  const price = dec(salePrice);
  if (!Number.isFinite(price) || price <= 0) return '—';
  const profit = price - avgCost;
  const pct = (profit / price) * 100;
  return `${fmtMoney(profit)} (${fmtPct(pct)})`;
}

function fmtSalePrice(salePrice: { toString(): string } | null | undefined) {
  if (salePrice == null) return '—';
  const n = dec(salePrice);
  return n > 0 ? fmtMoney(n) : '—';
}

/** Valor de estoque a preço de venda: saldo físico × preço cadastrado. */
function saleStockValue(qty: number, salePrice: { toString(): string } | null | undefined): number {
  if (salePrice == null || qty <= 0) return 0;
  const price = dec(salePrice);
  if (!Number.isFinite(price) || price <= 0) return 0;
  return qty * price;
}

type BalanceBucket = { qty: number; value: number };

function applyMovement(bucket: BalanceBucket, type: StockMovementType, quantity: number, unitCost: number | null) {
  const q = quantity;
  if (type === StockMovementType.OUT) {
    const avg = bucket.qty > 0 ? bucket.value / bucket.qty : unitCost ?? 0;
    bucket.qty -= q;
    bucket.value -= q * avg;
    if (bucket.qty <= 0.0001) {
      bucket.qty = 0;
      bucket.value = 0;
    }
    return;
  }
  bucket.qty += q;
  bucket.value += q * (unitCost ?? 0);
}

@Injectable()
export class ProductsReportService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly eggStock: EggProductionStockService,
  ) {}

  async report(user: JwtPayload, query: ProductsReportQuery) {
    this.validateQuery(query);
    if (query.variant === 'geral') return this.reportGeral(user, query);
    if (query.variant === 'saldo_fisico') return this.reportSaldoFisico(user, query);
    if (query.variant === 'saldo_financeiro') return this.reportSaldoFinanceiro(user, query);
    return this.reportGiro(user, query);
  }

  private validateQuery(query: ProductsReportQuery) {
    if (query.variant === 'giro') {
      const from = parseDay(query.from, 'start');
      const to = parseDay(query.to, 'end');
      if (!from || !to) throw new BadRequestException('Informe o período de e até para o relatório de giro.');
      if (from > to) throw new BadRequestException('Período inválido.');
    }
  }

  private periodMeta(query: ProductsReportQuery) {
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');
    return {
      from: from ? isoDate(from) : null,
      to: to ? isoDate(to) : null,
    };
  }

  private async locationMeta(user: JwtPayload, ids: string[] | undefined) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    if (!ids?.length) {
      return { labels: ['Todos os locais'], ids: [] as string[] };
    }
    const locs = await prisma.stockLocation.findMany({
      where: { id: { in: ids }, isActive: true },
      orderBy: { code: 'asc' },
    });
    if (locs.length === 0) {
      return { labels: ['Locais selecionados'], ids };
    }
    return { labels: locs.map((l) => `${l.code} — ${l.name}`), ids: locs.map((l) => l.id) };
  }

  private async reportGeral(user: JwtPayload, query: ProductsReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    const columns = [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Nome' },
      { key: 'type', label: 'Tipo' },
      { key: 'unit', label: 'Un.' },
      { key: 'minStock', label: 'Est. mín.' },
      { key: 'ncm', label: 'NCM' },
    ];
    const rows: ReportRow[] = products.map((p) => ({
      sku: p.sku,
      name: p.name,
      type: labelProductType(p.type),
      unit: p.unit,
      minStock: dec(p.minStockQty),
      ncm: p.ncm ?? '—',
    }));
    return {
      variant: query.variant,
      title: 'Produtos e materiais — Listagem Geral',
      period: { from: null, to: null },
      stockLocations: null as string[] | null,
      columns,
      rows,
      footer: {
        sku: 'Total',
        name: `${rows.length} produto(s)`,
        type: '—',
        unit: '—',
        minStock: '—',
        ncm: '—',
      },
    };
  }

  private movementWhereForLocations(locationIds: string[] | undefined) {
    if (!locationIds?.length) return {};
    return { stockLocationId: { in: locationIds } };
  }

  private async loadEggPackagingLinks(tenantSlug: string): Promise<EggPackagingLinks | null> {
    const cfg = await this.eggStock.getConfig(tenantSlug);
    if (!cfg.cartonProductId && !cfg.boxProductId) return null;
    return {
      cartonProductId: cfg.cartonProductId,
      boxProductId: cfg.boxProductId,
      eggsPerCarton: cfg.eggsPerCarton,
      cartonsPerBox: cfg.cartonsPerBox,
    };
  }

  private enrichRowEggColumns(
    row: ReportRow,
    links: EggPackagingLinks | null,
    qty: number,
  ): ReportRow {
    if (!links) {
      return { ...row, packRoleFmt: '—', equivCartonsFmt: '—' };
    }
    const productId = String(row._productId ?? '');
    const role = eggProductRole(links, productId);
    if (!role || qty <= 0) {
      return { ...row, packRoleFmt: role === 'carton' ? 'Cartela avulsa' : role === 'box' ? 'Caixa' : '—', equivCartonsFmt: '—' };
    }
    const cpb = Math.max(links.cartonsPerBox, 1);
    const equiv = qtyToEquivalentCartons(role, qty, cpb);
    const packLabel =
      role === 'carton'
        ? 'Cartela avulsa'
        : `Caixa (${fmtQty(cpb)} cart.)`;
    return {
      ...row,
      packRoleFmt: packLabel,
      equivCartonsFmt: fmtQty(equiv),
    };
  }

  private buildEggPackagingSummary(
    links: EggPackagingLinks,
    products: { id: string; salePrice: { toString(): string } | null }[],
    buckets: Map<string, BalanceBucket>,
    mode: 'physical' | 'financial',
    splitByLocation: boolean,
  ): EggPackagingSummaryBlock | null {
    if (splitByLocation) {
      return {
        title: 'Ovos embalados (consolidado)',
        note: 'Com filtro por local, use a visão global (sem locais) para o total consolidado sem dupla contagem.',
        lines: [],
      };
    }

    const loose = links.cartonProductId
      ? (buckets.get(links.cartonProductId) ?? { qty: 0, value: 0 })
      : { qty: 0, value: 0 };
    const boxes = links.boxProductId
      ? (buckets.get(links.boxProductId) ?? { qty: 0, value: 0 })
      : { qty: 0, value: 0 };

    const cpb = Math.max(links.cartonsPerBox, 1);
    const epc = Math.max(links.eggsPerCarton, 1);
    const equiv = equivalentCartonsFromStock(loose.qty, boxes.qty, cpb);
    const totalEggs = equiv * epc;

    const cartonProduct = links.cartonProductId
      ? products.find((p) => p.id === links.cartonProductId)
      : undefined;
    const boxProduct = links.boxProductId
      ? products.find((p) => p.id === links.boxProductId)
      : undefined;

    const lines: EggPackagingSummaryLine[] = [
      { label: 'Cartelas avulsas (saldo)', value: fmtQty(loose.qty) },
      { label: 'Caixas (saldo)', value: fmtQty(boxes.qty) },
      { label: 'Total equivalente (cartelas)', value: fmtQty(equiv) },
      { label: 'Total ovos comerciais (equiv.)', value: fmtQty(totalEggs) },
    ];

    if (mode === 'financial') {
      const depotRetail =
        saleStockValue(loose.qty, cartonProduct?.salePrice ?? null) +
        saleStockValue(boxes.qty, boxProduct?.salePrice ?? null);
      const refCartonPrice = cartonProduct?.salePrice ?? null;
      const refRetail = saleStockValue(equiv, refCartonPrice);
      const depotCost = loose.value + boxes.value;
      const depotProfit = depotRetail - depotCost;
      const refProfit = refRetail - depotCost;

      lines.push(
        {
          label: 'Valor venda no depósito (por embalagem)',
          value: depotRetail > 0 ? fmtMoney(depotRetail) : '—',
        },
        {
          label: 'Valor ref. preço cartela (consolidado)',
          value: refRetail > 0 ? fmtMoney(refRetail) : '—',
        },
        { label: 'Custo estoque (cartela + caixa)', value: depotCost > 0 ? fmtMoney(depotCost) : fmtMoney(0) },
        {
          label: 'Lucro no depósito (embalagem × preço)',
          value: depotRetail > 0 || depotCost > 0 ? fmtMoney(depotProfit) : '—',
        },
        {
          label: 'Lucro ref. preço cartela',
          value: refRetail > 0 || depotCost > 0 ? fmtMoney(refProfit) : '—',
        },
      );
    }

    return {
      title: 'Ovos embalados — visão consolidada',
      note:
        'Cartela avulsa e caixa não somam em dobro: caixa = várias cartelas; o equivalente usa cartelas avulsas + caixas × cartelas/caixa. Reprocesse a postura no estoque se os saldos foram gerados antes desta regra.',
      lines,
    };
  }

  private async computeBalances(
    user: JwtPayload,
    locationIds: string[] | undefined,
    splitByLocation: boolean,
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const [products, movements, locations] = await Promise.all([
      prisma.product.findMany({ orderBy: { name: 'asc' } }),
      prisma.stockMovement.findMany({
        where: this.movementWhereForLocations(locationIds),
        orderBy: [{ movedAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.stockLocation.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    ]);
    const locById = new Map(locations.map((l) => [l.id, l]));

    type Key = string;
    const buckets = new Map<Key, BalanceBucket>();

    const keyFor = (productId: string, locationId: string | null) => {
      if (!splitByLocation) return productId;
      return `${productId}|${locationId ?? '__none__'}`;
    };

    for (const m of movements) {
      const k = keyFor(m.productId, m.stockLocationId);
      if (!buckets.has(k)) buckets.set(k, { qty: 0, value: 0 });
      applyMovement(buckets.get(k)!, m.type, dec(m.quantity), m.unitCost != null ? dec(m.unitCost) : null);
    }

    const rows: ReportRow[] = [];

    if (!splitByLocation) {
      for (const p of products) {
        const b = buckets.get(p.id) ?? { qty: 0, value: 0 };
        rows.push({
          _productId: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          minStock: dec(p.minStockQty),
          salePriceFmt: fmtSalePrice(p.salePrice),
          balance: b.qty,
          balanceFmt: fmtQty(b.qty),
        });
      }
    } else {
      const locIdsInScope =
        locationIds?.length ? locationIds : [...locations.map((l) => l.id), '__none__'];
      for (const p of products) {
        for (const locKey of locIdsInScope) {
          const locationId = locKey === '__none__' ? null : locKey;
          const k = keyFor(p.id, locationId);
          const b = buckets.get(k) ?? { qty: 0, value: 0 };
          const locLabel =
            locationId == null
              ? 'Sem local definido'
              : locById.get(locationId)
                ? `${locById.get(locationId)!.code} — ${locById.get(locationId)!.name}`
                : '—';
          rows.push({
            _productId: p.id,
            sku: p.sku,
            name: p.name,
            unit: p.unit,
            location: locLabel,
            minStock: dec(p.minStockQty),
            salePriceFmt: fmtSalePrice(p.salePrice),
            balance: b.qty,
            balanceFmt: fmtQty(b.qty),
          });
        }
      }
    }

    return { rows, products, buckets };
  }

  private async reportSaldoFisico(user: JwtPayload, query: ProductsReportQuery) {
    const locMeta = await this.locationMeta(user, query.stockLocationIds);
    const splitByLocation = Boolean(query.stockLocationIds?.length);
    const locationIds = locMeta.ids.length ? locMeta.ids : undefined;
    const { rows: rawRows, products, buckets } = await this.computeBalances(
      user,
      locationIds,
      splitByLocation,
    );
    const eggLinks = await this.loadEggPackagingLinks(user.tenantSlug);

    const columns = splitByLocation
      ? [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Nome' },
          { key: 'location', label: 'Local de estoque' },
          { key: 'unit', label: 'Un.' },
          { key: 'packRoleFmt', label: 'Papel (ovos)' },
          { key: 'minStock', label: 'Est. mín.' },
          { key: 'salePriceFmt', label: 'Preço venda' },
          { key: 'balanceFmt', label: 'Saldo físico' },
          { key: 'equivCartonsFmt', label: 'Equiv. cartelas' },
        ]
      : [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Nome' },
          { key: 'unit', label: 'Un.' },
          { key: 'packRoleFmt', label: 'Papel (ovos)' },
          { key: 'minStock', label: 'Est. mín.' },
          { key: 'salePriceFmt', label: 'Preço venda' },
          { key: 'balanceFmt', label: 'Saldo físico' },
          { key: 'equivCartonsFmt', label: 'Equiv. cartelas' },
        ];

    const filteredRaw = splitByLocation
      ? rawRows.filter((r) => Math.abs(Number(r.balance)) > 0.0001)
      : rawRows;
    const enriched = filteredRaw.map((row) =>
      this.enrichRowEggColumns(row, eggLinks, Number(row.balance)),
    );
    const rows = enriched.map(({ balance, _productId, ...rest }) => rest);

    const totalQty = sumColumn(filteredRaw, 'balance');
    const footer: ReportRow = {
      sku: 'Total',
      name: `${rows.length} linha(s) · ver consolidado ovos abaixo`,
      unit: '—',
      packRoleFmt: '—',
      minStock: '—',
      salePriceFmt: '—',
      balanceFmt: fmtQty(totalQty),
      equivCartonsFmt: '—',
    };
    if (splitByLocation) {
      footer.location = locMeta.labels.join('; ');
    }

    const eggPackagingSummary =
      eggLinks != null
        ? this.buildEggPackagingSummary(eggLinks, products, buckets, 'physical', splitByLocation)
        : null;

    return {
      variant: query.variant,
      title: 'Produtos e materiais — Saldo Físico',
      period: { from: null, to: null },
      stockLocations: locMeta.labels,
      columns,
      rows,
      footer,
      eggPackagingSummary,
    };
  }

  private async reportSaldoFinanceiro(user: JwtPayload, query: ProductsReportQuery) {
    const locMeta = await this.locationMeta(user, query.stockLocationIds);
    const splitByLocation = Boolean(query.stockLocationIds?.length);
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const [products, movements, locations] = await Promise.all([
      prisma.product.findMany({ orderBy: { name: 'asc' } }),
      prisma.stockMovement.findMany({
        where: this.movementWhereForLocations(locMeta.ids.length ? locMeta.ids : undefined),
        orderBy: [{ movedAt: 'asc' }, { id: 'asc' }],
      }),
      prisma.stockLocation.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } }),
    ]);
    const locById = new Map(locations.map((l) => [l.id, l]));

    type Key = string;
    const buckets = new Map<Key, BalanceBucket>();
    const keyFor = (productId: string, locationId: string | null) => {
      if (!splitByLocation) return productId;
      return `${productId}|${locationId ?? '__none__'}`;
    };

    for (const m of movements) {
      const k = keyFor(m.productId, m.stockLocationId);
      if (!buckets.has(k)) buckets.set(k, { qty: 0, value: 0 });
      applyMovement(buckets.get(k)!, m.type, dec(m.quantity), m.unitCost != null ? dec(m.unitCost) : null);
    }

    const eggLinks = await this.loadEggPackagingLinks(user.tenantSlug);
    const rows: ReportRow[] = [];

    if (!splitByLocation) {
      for (const p of products) {
        const b = buckets.get(p.id) ?? { qty: 0, value: 0 };
        const retailValue = saleStockValue(b.qty, p.salePrice);
        const avgCost = b.qty > 0 ? b.value / b.qty : 0;
        const stockProfit = retailValue > 0 && b.qty > 0 ? retailValue - b.value : 0;
        const baseRow: ReportRow = {
          _productId: p.id,
          sku: p.sku,
          name: p.name,
          unit: p.unit,
          salePriceFmt: fmtSalePrice(p.salePrice),
          balanceFmt: fmtQty(b.qty),
          unitCostFmt: b.qty > 0 ? fmtMoney(avgCost) : '—',
          unitProfitFmt: b.qty > 0 ? fmtUnitProfit(p.salePrice, avgCost) : '—',
          valueFmt: retailValue > 0 ? fmtMoney(retailValue) : '—',
          profitFmt: retailValue > 0 && b.qty > 0 ? fmtMoney(stockProfit) : '—',
          _value: retailValue,
          _profit: stockProfit,
          _balance: b.qty,
        };
        rows.push(this.enrichRowEggColumns(baseRow, eggLinks, b.qty));
      }
    } else {
      const locIdsInScope =
        locMeta.ids.length ? locMeta.ids : [...locations.map((l) => l.id), '__none__'];
      for (const p of products) {
        for (const locKey of locIdsInScope) {
          const locationId = locKey === '__none__' ? null : locKey;
          const k = keyFor(p.id, locationId);
          const b = buckets.get(k) ?? { qty: 0, value: 0 };
          const retailValue = saleStockValue(b.qty, p.salePrice);
          const avgCost = b.qty > 0 ? b.value / b.qty : 0;
          const stockProfit = retailValue > 0 && b.qty > 0 ? retailValue - b.value : 0;
          const locLabel =
            locationId == null
              ? 'Sem local definido'
              : locById.get(locationId)
                ? `${locById.get(locationId)!.code} — ${locById.get(locationId)!.name}`
                : '—';
          const baseRow: ReportRow = {
            _productId: p.id,
            sku: p.sku,
            name: p.name,
            location: locLabel,
            unit: p.unit,
            salePriceFmt: fmtSalePrice(p.salePrice),
            balanceFmt: fmtQty(b.qty),
            unitCostFmt: b.qty > 0 ? fmtMoney(avgCost) : '—',
            unitProfitFmt: b.qty > 0 ? fmtUnitProfit(p.salePrice, avgCost) : '—',
            valueFmt: retailValue > 0 ? fmtMoney(retailValue) : '—',
            profitFmt: retailValue > 0 && b.qty > 0 ? fmtMoney(stockProfit) : '—',
            _value: retailValue,
            _profit: stockProfit,
            _balance: b.qty,
          };
          rows.push(this.enrichRowEggColumns(baseRow, eggLinks, b.qty));
        }
      }
    }

    const columns = splitByLocation
      ? [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Nome' },
          { key: 'location', label: 'Local de estoque' },
          { key: 'unit', label: 'Un.' },
          { key: 'packRoleFmt', label: 'Papel (ovos)' },
          { key: 'salePriceFmt', label: 'Preço venda' },
          { key: 'balanceFmt', label: 'Saldo físico' },
          { key: 'equivCartonsFmt', label: 'Equiv. cartelas' },
          { key: 'unitCostFmt', label: 'Custo médio (ref.)' },
          { key: 'unitProfitFmt', label: 'Lucro/un.' },
          { key: 'valueFmt', label: 'Saldo financeiro (qtd × preço)' },
          { key: 'profitFmt', label: 'Lucro em estoque' },
        ]
      : [
          { key: 'sku', label: 'SKU' },
          { key: 'name', label: 'Nome' },
          { key: 'unit', label: 'Un.' },
          { key: 'packRoleFmt', label: 'Papel (ovos)' },
          { key: 'salePriceFmt', label: 'Preço venda' },
          { key: 'balanceFmt', label: 'Saldo físico' },
          { key: 'equivCartonsFmt', label: 'Equiv. cartelas' },
          { key: 'unitCostFmt', label: 'Custo médio (ref.)' },
          { key: 'unitProfitFmt', label: 'Lucro/un.' },
          { key: 'valueFmt', label: 'Saldo financeiro (qtd × preço)' },
          { key: 'profitFmt', label: 'Lucro em estoque' },
        ];

    const filteredRows = splitByLocation
      ? rows.filter((r) => Math.abs(Number(r._balance)) > 0.0001)
      : rows;
    const displayRows = filteredRows.map(({ _value, _profit, _balance, _productId, ...rest }) => rest);
    const footerTotalValue = filteredRows.reduce((s, r) => s + Number(r._value), 0);
    const footerTotalProfit = filteredRows.reduce((s, r) => s + Number(r._profit), 0);

    const footer: ReportRow = {
      sku: 'Total',
      name: `${displayRows.length} linha(s) · totais gerais (ovos: ver consolidado)`,
      unit: '—',
      packRoleFmt: '—',
      salePriceFmt: '—',
      balanceFmt: '—',
      equivCartonsFmt: '—',
      unitCostFmt: '—',
      unitProfitFmt: '—',
      valueFmt: fmtMoney(footerTotalValue),
      profitFmt: fmtMoney(footerTotalProfit),
    };
    if (splitByLocation) footer.location = locMeta.labels.join('; ');

    const eggPackagingSummary =
      eggLinks != null
        ? this.buildEggPackagingSummary(eggLinks, products, buckets, 'financial', splitByLocation)
        : null;

    return {
      variant: query.variant,
      title: 'Produtos e materiais — Saldo Financeiro',
      period: { from: null, to: null },
      stockLocations: locMeta.labels,
      columns,
      rows: displayRows,
      footer,
      eggPackagingSummary,
    };
  }

  private async reportGiro(user: JwtPayload, query: ProductsReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = parseDay(query.from, 'start')!;
    const to = parseDay(query.to, 'end')!;

    const items = await prisma.salesOrderItem.findMany({
      where: {
        productId: { not: null },
        salesOrder: {
          status: 'CONFIRMED',
          orderDate: { gte: from, lte: to },
        },
      },
      include: {
        product: { select: { sku: true, name: true, unit: true, type: true, salePrice: true } },
        salesOrder: { select: { orderDate: true } },
      },
    });

    const byProduct = new Map<
      string,
      {
        sku: string;
        name: string;
        unit: string;
        type: string;
        salePrice: { toString(): string } | null;
        qty: number;
        revenue: number;
        orders: number;
      }
    >();

    for (const item of items) {
      if (!item.productId || !item.product) continue;
      const pid = item.productId;
      const q = dec(item.quantity);
      const rev = q * dec(item.unitPrice) - dec(item.discount);
      const cur = byProduct.get(pid) ?? {
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit,
        type: labelProductType(item.product.type),
        salePrice: item.product.salePrice,
        qty: 0,
        revenue: 0,
        orders: 0,
      };
      cur.qty += q;
      cur.revenue += rev;
      cur.orders += 1;
      byProduct.set(pid, cur);
    }

    const sorted = [...byProduct.values()].sort((a, b) => b.qty - a.qty);

    const columns = [
      { key: 'rank', label: '#' },
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Nome' },
      { key: 'type', label: 'Tipo' },
      { key: 'unit', label: 'Un.' },
      { key: 'salePriceFmt', label: 'Preço venda' },
      { key: 'qtyFmt', label: 'Qtd. vendida' },
      { key: 'revenueFmt', label: 'Receita' },
      { key: 'lines', label: 'Itens em pedidos' },
    ];

    const rows: ReportRow[] = sorted.map((r, i) => ({
      rank: i + 1,
      sku: r.sku,
      name: r.name,
      type: r.type,
      unit: r.unit,
      salePriceFmt: fmtSalePrice(r.salePrice),
      qtyFmt: fmtQty(r.qty),
      revenueFmt: fmtMoney(r.revenue),
      lines: r.orders,
      _qty: r.qty,
      _rev: r.revenue,
    }));

    const totalQty = sumColumn(rows, '_qty');
    const totalRev = sumColumn(rows, '_rev');
    const displayRows = rows.map(({ _qty, _rev, ...rest }) => rest);

    return {
      variant: query.variant,
      title: 'Produtos e materiais — Giro (mais vendidos)',
      period: this.periodMeta(query),
      stockLocations: null,
      columns,
      rows: displayRows,
      footer: {
        rank: '—',
        sku: 'Total',
        name: `${displayRows.length} produto(s)`,
        type: '—',
        unit: '—',
        salePriceFmt: '—',
        qtyFmt: fmtQty(totalQty),
        revenueFmt: fmtMoney(totalRev),
        lines: '—',
      },
    };
  }
}
