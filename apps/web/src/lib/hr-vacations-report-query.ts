import { navigateToReportPrint } from '@/lib/report-print-nav';

export type HrVacationsReportVariant = 'espelho' | 'listagem';

export type HrVacationsReportFilters = {
  variant: HrVacationsReportVariant;
  from: string;
  to: string;
  jobTitle: string;
  vacationId: string;
};

export function hrVacationsReportTitle(variant: HrVacationsReportVariant): string {
  return variant === 'espelho' ? 'RH — Espelho de férias' : 'RH — Listagem de férias';
}

export function defaultHrVacationsReportFilters(
  variant: HrVacationsReportVariant = 'listagem',
): HrVacationsReportFilters {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    variant,
    from,
    to,
    jobTitle: '',
    vacationId: '',
  };
}

export function buildHrVacationsReportSearchParams(filters: HrVacationsReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.variant === 'listagem') {
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
    if (filters.jobTitle) p.set('jobTitle', filters.jobTitle);
  } else if (filters.vacationId) {
    p.set('vacationId', filters.vacationId);
  }
  return p;
}

export function buildHrVacationsReportApiPath(filters: HrVacationsReportFilters): string {
  return `/v1/reports/hr-vacations?${buildHrVacationsReportSearchParams(filters).toString()}`;
}

export function openHrVacationsReportPrint(filters: HrVacationsReportFilters, returnHref?: string) {
  const qs = buildHrVacationsReportSearchParams(filters);
  qs.set('title', hrVacationsReportTitle(filters.variant));
  navigateToReportPrint(`/relatorios/rh/ferias/impressao?${qs.toString()}`, returnHref);
}

export function openHrVacationEspelhoPrint(vacationId: string, returnHref?: string) {
  openHrVacationsReportPrint(
    { ...defaultHrVacationsReportFilters('espelho'), variant: 'espelho', vacationId },
    returnHref,
  );
}
