import { navigateToReportPrint } from '@/lib/report-print-nav';

export type StockMovementsReportFilters = {
  from: string;
  to: string;
  controlMin: string;
  controlMax: string;
  chartAccountId: string;
  includeIn: boolean;
  includeOut: boolean;
  includeAdjust: boolean;
};

export const STOCK_MOVEMENTS_REPORT_TITLE = 'Estoque — movimentações';

export function defaultStockMovementsReportFilters(): StockMovementsReportFilters {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    from,
    to,
    controlMin: '',
    controlMax: '',
    chartAccountId: '',
    includeIn: true,
    includeOut: true,
    includeAdjust: true,
  };
}

export function buildStockMovementsReportSearchParams(filters: StockMovementsReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
  if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  if (filters.chartAccountId) p.set('chartAccountId', filters.chartAccountId);
  p.set('includeIn', filters.includeIn ? '1' : '0');
  p.set('includeOut', filters.includeOut ? '1' : '0');
  p.set('includeAdjust', filters.includeAdjust ? '1' : '0');
  return p;
}

export function buildStockMovementsReportApiPath(filters: StockMovementsReportFilters): string {
  return `/v1/reports/stock-movements?${buildStockMovementsReportSearchParams(filters).toString()}`;
}

export function openStockMovementsReportPrint(filters: StockMovementsReportFilters, returnHref?: string) {
  const qs = buildStockMovementsReportSearchParams(filters);
  qs.set('title', STOCK_MOVEMENTS_REPORT_TITLE);
  navigateToReportPrint(`/relatorios/estoque/movimentacoes/impressao?${qs.toString()}`, returnHref);
}
