import { navigateToReportPrint } from '@/lib/report-print-nav';

export type HrEmployeesReportSort = 'controle' | 'nome' | 'salario_asc' | 'salario_desc';

export type HrEmployeesReportFilters = {
  variant: 'listagem_geral';
  controlMin: string;
  controlMax: string;
  sort: HrEmployeesReportSort;
};

export const HR_EMPLOYEES_SORT_OPTIONS: { id: HrEmployeesReportSort; label: string }[] = [
  { id: 'controle', label: 'Número de controle' },
  { id: 'nome', label: 'Ordem alfabética (nome)' },
  { id: 'salario_asc', label: 'Salário — menor para maior' },
  { id: 'salario_desc', label: 'Salário — maior para menor' },
];

export const HR_EMPLOYEES_REPORT_TITLE = 'RH — Funcionários (listagem geral)';

export function defaultHrEmployeesReportFilters(): HrEmployeesReportFilters {
  return {
    variant: 'listagem_geral',
    controlMin: '',
    controlMax: '',
    sort: 'controle',
  };
}

export function buildHrEmployeesReportSearchParams(filters: HrEmployeesReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  p.set('sort', filters.sort);
  if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
  if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  return p;
}

export function buildHrEmployeesReportApiPath(filters: HrEmployeesReportFilters): string {
  return `/v1/reports/hr-employees?${buildHrEmployeesReportSearchParams(filters).toString()}`;
}

export function openHrEmployeesReportPrint(filters: HrEmployeesReportFilters, returnHref?: string) {
  const qs = buildHrEmployeesReportSearchParams(filters);
  qs.set('title', HR_EMPLOYEES_REPORT_TITLE);
  navigateToReportPrint(`/relatorios/rh/funcionarios/impressao?${qs.toString()}`, returnHref);
}
