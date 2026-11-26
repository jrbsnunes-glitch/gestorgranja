import { cashSessionStatusUi } from '@/lib/cash-session-status';
import { formatRecordControl } from '@/lib/record-control';

export type ExpenseCashInfo = {
  controlNumber: number;
  openedAt: string;
  status: string;
  operator?: string | null;
  closedAt?: string | null;
} | null;

export function expenseCashCaption(cash: ExpenseCashInfo) {
  if (!cash) return 'Despesa fora do caixa';
  const status = cashSessionStatusUi(cash.status).label;
  const opened = new Date(cash.openedAt).toLocaleString('pt-BR');
  return `Caixa ${formatRecordControl(cash.controlNumber)} · aberto em ${opened} · ${status}`;
}

export function ExpenseCashLegend({ cash }: { cash: ExpenseCashInfo }) {
  if (!cash) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
        Despesa fora do caixa
      </p>
    );
  }
  const status = cashSessionStatusUi(cash.status);
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-semibold">Caixa {formatRecordControl(cash.controlNumber)}</p>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
      </div>
      <p className="mt-1 text-xs text-slate-600">
        Aberto em {new Date(cash.openedAt).toLocaleString('pt-BR')}
        {cash.closedAt ? ` · Fechado em ${new Date(cash.closedAt).toLocaleString('pt-BR')}` : ''}
        {cash.operator ? ` · ${cash.operator}` : ''}
      </p>
    </div>
  );
}
