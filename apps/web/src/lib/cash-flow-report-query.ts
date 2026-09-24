import { navigateToReportPrint } from '@/lib/report-print-nav';

export const CASH_FLOW_KINDS = [
  { value: '', label: 'Todos os tipos' },
  { value: 'CP paga', label: 'CP paga' },
  { value: 'CP prevista', label: 'CP prevista' },
  { value: 'CR recebida', label: 'CR recebida' },
  { value: 'CR prevista', label: 'CR prevista' },
  { value: 'Compra prevista', label: 'Compra prevista' },
  { value: 'Caixa', label: 'Caixa' },
] as const;

export type CashFlowReportFilters = {
  from: string;
  to: string;
  kind: string;
  includePayables: boolean;
  includeReceivables: boolean;
  includePurchases: boolean;
  includeBankBalance: boolean;
};

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function defaultCashFlowReportFilters(): CashFlowReportFilters {
  return {
    from: monthStartIso(),
    to: todayIso(),
    kind: '',
    includePayables: true,
    includeReceivables: true,
    includePurchases: true,
    includeBankBalance: true,
  };
}

export function buildCashFlowSearchParams(filters: CashFlowReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.kind) p.set('kind', filters.kind);
  p.set('includePayables', filters.includePayables ? '1' : '0');
  p.set('includeReceivables', filters.includeReceivables ? '1' : '0');
  p.set('includePurchases', filters.includePurchases ? '1' : '0');
  p.set('includeBankBalance', filters.includeBankBalance ? '1' : '0');
  return p;
}

export function openCashFlowReportPrint(filters: CashFlowReportFilters) {
  const qs = buildCashFlowSearchParams(filters).toString();
  navigateToReportPrint(`/relatorios/financeiro/fluxo/impressao?${qs}`);
}
