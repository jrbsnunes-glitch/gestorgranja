import { formatBrl } from '@/lib/money';
import type { personalAgendaReportTotals } from '@/lib/personal-agenda-report';

export function PersonalAgendaTotalsBox({
  totals,
}: {
  totals: ReturnType<typeof personalAgendaReportTotals>;
}) {
  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totais</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TotalCell label="Pagas" value={totals.paid} count={totals.paidCount} tone="emerald" />
        <TotalCell label="Abertas" value={totals.open} count={totals.openCount} tone="amber" />
        <TotalCell label="Vencidas" value={totals.overdue} count={totals.overdueCount} tone="rose" />
        <TotalCell label="Total" value={totals.total} count={totals.count} tone="slate" />
      </div>
    </section>
  );
}

function TotalCell({
  label,
  value,
  count,
  tone,
}: {
  label: string;
  value: number;
  count: number;
  tone: 'emerald' | 'amber' | 'rose' | 'slate';
}) {
  const cls =
    tone === 'emerald'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'rose'
          ? 'border-red-200 bg-red-50'
          : 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${cls}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-slate-900">{formatBrl(value)}</p>
      <p className="text-xs text-slate-500">
        {count} {count === 1 ? 'conta' : 'contas'}
      </p>
    </div>
  );
}
