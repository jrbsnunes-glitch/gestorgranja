import { navigateToReportPrint } from '@/lib/report-print-nav';

export type ProductsReportVariant = 'geral' | 'saldo_fisico' | 'saldo_financeiro' | 'giro';

export type ProductsReportFilters = {
  variant: ProductsReportVariant;
  from: string;
  to: string;
  stockLocationIds: string[];
};

export const PRODUCTS_REPORT_VARIANTS: { id: ProductsReportVariant; label: string; hint?: string }[] = [
  { id: 'geral', label: 'Listagem geral' },
  {
    id: 'saldo_fisico',
    label: 'Saldo físico',
    hint: 'Saldo por SKU. Ovos: cartela avulsa + caixa com equivalente e bloco consolidado (sem dupla contagem).',
  },
  {
    id: 'saldo_financeiro',
    label: 'Saldo financeiro',
    hint: 'Por SKU: qtd × preço e lucro. Ovos: valor por embalagem no depósito + consolidado ref. cartela.',
  },
  {
    id: 'giro',
    label: 'Giro — produtos mais vendidos',
    hint: 'Ranking por quantidade vendida no período (pedidos confirmados).',
  },
];

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultProductsReportFilters(): ProductsReportFilters {
  return {
    variant: 'geral',
    from: monthStartIso(),
    to: todayIso(),
    stockLocationIds: [],
  };
}

export function buildProductsReportSearchParams(filters: ProductsReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.variant === 'giro') {
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
  }
  if (
    (filters.variant === 'saldo_fisico' || filters.variant === 'saldo_financeiro') &&
    filters.stockLocationIds.length > 0
  ) {
    p.set('stockLocationIds', filters.stockLocationIds.join(','));
  }
  return p;
}

export function buildProductsReportApiPath(filters: ProductsReportFilters): string {
  return `/v1/reports/products?${buildProductsReportSearchParams(filters).toString()}`;
}

export function productsReportTitle(variant: ProductsReportVariant): string {
  return PRODUCTS_REPORT_VARIANTS.find((v) => v.id === variant)?.label ?? 'Relatório';
}

export function openProductsReportPrint(
  filters: ProductsReportFilters,
  title: string,
  returnHref?: string,
) {
  const qs = buildProductsReportSearchParams(filters);
  qs.set('title', title);
  navigateToReportPrint(`/relatorios/produtos/impressao?${qs.toString()}`, returnHref);
}
