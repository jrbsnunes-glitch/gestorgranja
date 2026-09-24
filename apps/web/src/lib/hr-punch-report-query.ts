export type HrPunchReportFilters = {
  from: string;
  to: string;
};

export function defaultHrPunchReportFilters(): HrPunchReportFilters {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${String(now.getDate()).padStart(2, '0')}` };
}

export function buildHrPunchReportApiPath(filters: HrPunchReportFilters): string {
  const q = new URLSearchParams();
  if (filters.from) q.set('from', filters.from);
  if (filters.to) q.set('to', filters.to);
  return `/v1/hr/reports/punches?${q.toString()}`;
}

export function openHrPunchReportPrint(filters: HrPunchReportFilters) {
  const q = new URLSearchParams();
  if (filters.from) q.set('from', filters.from);
  if (filters.to) q.set('to', filters.to);
  window.open(`/relatorios/rh/ponto/impressao?${q.toString()}`, '_blank', 'noopener,noreferrer');
}
