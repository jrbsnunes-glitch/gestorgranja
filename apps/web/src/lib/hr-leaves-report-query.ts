import { navigateToReportPrint } from '@/lib/report-print-nav';

export type HrLeavesReportVariant = 'espelho' | 'listagem';

export type HrLeavesReportFilters = {
  variant: HrLeavesReportVariant;
  from: string;
  to: string;
  jobTitle: string;
  leaveId: string;
};

export function hrLeavesReportTitle(variant: HrLeavesReportVariant): string {
  return variant === 'espelho' ? 'RH — Espelho de atestado' : 'RH — Listagem de atestados';
}

export function defaultHrLeavesReportFilters(variant: HrLeavesReportVariant = 'listagem'): HrLeavesReportFilters {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    variant,
    from,
    to,
    jobTitle: '',
    leaveId: '',
  };
}

export function buildHrLeavesReportSearchParams(filters: HrLeavesReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.variant === 'listagem') {
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    if (filters.jobTitle) p.set('jobTitle', filters.jobTitle);
  } else if (filters.leaveId) {
    p.set('leaveId', filters.leaveId);
  }
  return p;
}

export function buildHrLeavesReportApiPath(filters: HrLeavesReportFilters): string {
  return `/v1/reports/hr-leaves?${buildHrLeavesReportSearchParams(filters).toString()}`;
}

export function openHrLeavesReportPrint(filters: HrLeavesReportFilters, returnHref?: string) {
  const qs = buildHrLeavesReportSearchParams(filters);
  qs.set('title', hrLeavesReportTitle(filters.variant));
  navigateToReportPrint(`/relatorios/rh/atestados/impressao?${qs.toString()}`, returnHref);
}

export function openHrLeaveEspelhoPrint(leaveId: string, returnHref?: string) {
  openHrLeavesReportPrint(
    { ...defaultHrLeavesReportFilters('espelho'), variant: 'espelho', leaveId },
    returnHref,
  );
}
