import { navigateToReportPrint } from '@/lib/report-print-nav';

export type FinanceTitleKind = 'payable' | 'receivable';

export type FinanceTitlesReportFilters = {
  kind: FinanceTitleKind;
  from: string;
  to: string;
  controlMin: string;
  controlMax: string;
  partnerId: string;
  includeOpen: boolean;
  includeSettled: boolean;
  includePartialPayment: boolean;
  includePartialOpen: boolean;
};

export const FINANCE_TITLE_BUCKET_LABELS: Record<string, string> = {
  open: 'Aberto',
  settled: 'Liquidado',
  partial_payment: 'Pagamento parcial',
  partial_open: 'Parcial em aberto',
};

export function buildFinanceTitlesReportSearchParams(filters: FinanceTitlesReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('kind', filters.kind);
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
  if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  if (filters.partnerId) p.set('partnerId', filters.partnerId);
  p.set('includeOpen', filters.includeOpen ? '1' : '0');
  p.set('includeSettled', filters.includeSettled ? '1' : '0');
  p.set('includePartialPayment', filters.includePartialPayment ? '1' : '0');
  p.set('includePartialOpen', filters.includePartialOpen ? '1' : '0');
  return p;
}

export function buildFinanceTitlesReportApiPath(filters: FinanceTitlesReportFilters): string {
  return `/v1/reports/finance-titles?${buildFinanceTitlesReportSearchParams(filters).toString()}`;
}

export function openFinanceTitlesReportPrint(filters: FinanceTitlesReportFilters, title: string) {
  const qs = buildFinanceTitlesReportSearchParams(filters);
  qs.set('title', title);
  navigateToReportPrint(`/relatorios/financeiro/impressao?${qs.toString()}`);
}

export function defaultFinanceTitlesFilters(kind: FinanceTitleKind): FinanceTitlesReportFilters {
  return {
    kind,
    from: '',
    to: '',
    controlMin: '',
    controlMax: '',
    partnerId: '',
    includeOpen: true,
    includeSettled: true,
    includePartialPayment: true,
    includePartialOpen: true,
  };
}
