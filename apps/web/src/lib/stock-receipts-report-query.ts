import { navigateToReportPrint } from '@/lib/report-print-nav';

export type StockReceiptsReportVariant = 'notas' | 'produtos_por_nota';

export type StockReceiptsReportFilters = {
  variant: StockReceiptsReportVariant;
  from: string;
  to: string;
  controlMin: string;
  controlMax: string;
  partnerId: string;
};

export const STOCK_RECEIPTS_REPORT_VARIANTS: {
  id: StockReceiptsReportVariant;
  label: string;
  hint: string;
}[] = [
  {
    id: 'notas',
    label: 'Resumo por nota',
    hint: 'Uma linha por NF de entrada (totais e quantidade de itens).',
  },
  {
    id: 'produtos_por_nota',
    label: 'Produtos por nota',
    hint: 'Detalha cada produto dentro de cada nota de entrada.',
  },
];

export function stockReceiptsReportTitle(variant: StockReceiptsReportVariant): string {
  return variant === 'produtos_por_nota'
    ? 'Entradas — produtos por nota'
    : 'Entradas — resumo por nota';
}

export function defaultStockReceiptsReportFilters(
  variant: StockReceiptsReportVariant = 'notas',
): StockReceiptsReportFilters {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    variant,
    from,
    to,
    controlMin: '',
    controlMax: '',
    partnerId: '',
  };
}

export function buildStockReceiptsReportSearchParams(
  filters: StockReceiptsReportFilters,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
  if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  if (filters.partnerId) p.set('partnerId', filters.partnerId);
  return p;
}

export function buildStockReceiptsReportApiPath(filters: StockReceiptsReportFilters): string {
  return `/v1/reports/stock-receipts?${buildStockReceiptsReportSearchParams(filters).toString()}`;
}

export function openStockReceiptsReportPrint(
  filters: StockReceiptsReportFilters,
  returnHref?: string,
) {
  const qs = buildStockReceiptsReportSearchParams(filters);
  qs.set('title', stockReceiptsReportTitle(filters.variant));
  navigateToReportPrint(`/relatorios/estoque/entradas/impressao?${qs.toString()}`, returnHref);
}
