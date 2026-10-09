import { navigateToReportPrint } from '@/lib/report-print-nav';

export type OperationProductionReportFilters = {
  from: string;
  to: string;
};

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultOperationProductionReportFilters(): OperationProductionReportFilters {
  return { from: monthStartIso(), to: todayIso() };
}

export function buildOperationProductionReportApiPath(filters: OperationProductionReportFilters): string {
  const p = new URLSearchParams();
  p.set('from', filters.from);
  p.set('to', filters.to);
  return `/v1/reports/operation-barn-comparison?${p.toString()}`;
}

export function openOperationProductionReportPrint(
  filters: OperationProductionReportFilters,
  returnHref = '/operacao/relatorios',
) {
  const qs = new URLSearchParams();
  qs.set('from', filters.from);
  qs.set('to', filters.to);
  qs.set('title', 'Comparativo de galpões e evolução da produção');
  navigateToReportPrint(`/relatorios/operacao/impressao?${qs.toString()}`, returnHref);
}
