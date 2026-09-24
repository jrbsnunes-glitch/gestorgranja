import { navigateToReportPrint } from '@/lib/report-print-nav';

export type CashReportVariant = 'controle' | 'periodo' | 'dia';

export type CashReportFilters = {
  variant: CashReportVariant;
  from: string;
  to: string;
  date: string;
  controlMin: string;
  controlMax: string;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export const CASH_REPORT_TITLES: Record<CashReportVariant, string> = {
  controle: 'Caixa — controle de sessão',
  periodo: 'Caixa — movimentação por período',
  dia: 'Caixa do dia',
};

export function defaultCashReportFilters(variant: CashReportVariant = 'dia'): CashReportFilters {
  const today = todayIso();
  return {
    variant,
    from: monthStartIso(),
    to: today,
    date: today,
    controlMin: '',
    controlMax: '',
  };
}

export function buildCashReportSearchParams(filters: CashReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.variant === 'controle') {
    if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
    if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  } else if (filters.variant === 'periodo') {
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
  } else {
    if (filters.date) p.set('date', filters.date);
  }
  return p;
}

export function buildCashReportApiPath(filters: CashReportFilters): string {
  return `/v1/reports/cash?${buildCashReportSearchParams(filters).toString()}`;
}

export function openCashReportPrint(filters: CashReportFilters) {
  const qs = buildCashReportSearchParams(filters);
  qs.set('title', CASH_REPORT_TITLES[filters.variant]);
  navigateToReportPrint(`/relatorios/financeiro/caixa/impressao?${qs.toString()}`);
}
