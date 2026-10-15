'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PERSONAL_BILL_KINDS, PersonalBillDescription } from '@/components/agenda/personal-bill-kind';
import { PersonalAgendaTotalsBox } from '@/components/agenda/personal-agenda-totals';
import { PageIntro } from '@/components/crud';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';
import {
  defaultPersonalAgendaReportFilters,
  filterPersonalAgendaBills,
  personalAgendaReportQuery,
  personalAgendaReportTotals,
  personalBillKindLabel,
  personalBillTone,
  personalBillToneLabel,
  type PersonalAgendaReportBill,
  type PersonalAgendaReportFilters,
} from '@/lib/personal-agenda-report';
import { navigateToReportPrint } from '@/lib/report-print-nav';

export default function AgendaPessoalRelatoriosPage() {
  const router = useRouter();
  const [items, setItems] = useState<PersonalAgendaReportBill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<PersonalAgendaReportFilters>(defaultPersonalAgendaReportFilters);

  const load = useCallback(() => {
    void apiFetch<{ items: PersonalAgendaReportBill[] }>('/v1/personal-agenda')
      .then((data) => setItems(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar contas'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => filterPersonalAgendaBills(items, filters), [items, filters]);
  const totals = useMemo(() => personalAgendaReportTotals(rows), [rows]);

  function patch(partial: Partial<PersonalAgendaReportFilters>) {
    setFilters((current) => ({ ...current, ...partial }));
    setError(null);
  }

  function printReport() {
    if (!filters.includePaid && !filters.includeOpen && !filters.includeOverdue) {
      setError('Marque ao menos uma situação: Pagas, Abertas ou Vencidas.');
      return;
    }
    const qs = personalAgendaReportQuery(filters);
    navigateToReportPrint(`/relatorios/agenda-pessoal/impressao?${qs.toString()}`, '/agenda-pessoal/relatorios');
  }

  return (
    <AdminShell title="Agenda Pessoal">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageIntro
          title="Relatórios"
          description="Contas da sua agenda pessoal. Estes valores não entram no caixa da granja."
          showModuleTabs={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push('/agenda-pessoal')}>
            Voltar
          </Button>
          <Button type="button" onClick={printReport}>
            Imprimir
          </Button>
        </div>
      </div>

      <PersonalAgendaTotalsBox totals={totals} />

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <ErrorBox message={error} />
        <div className="grid items-end gap-3 md:grid-cols-3">
          <FilterPeriodRangeFields
            idPrefix="agenda-rel"
            className="contents"
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => patch({ from })}
            onToChange={(to) => patch({ to })}
          />
          <label className="block text-sm">
            <span className="mb-1 block text-slate-600">Tipo de contas</span>
            <select
              className={inputClass}
              value={filters.category}
              onChange={(e) => patch({ category: e.target.value })}
            >
              <option value="">Todos os tipos</option>
              {PERSONAL_BILL_KINDS.map((kind) => (
                <option key={kind.id} value={kind.id}>
                  {kind.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm font-medium text-slate-700">Situação</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <StatusCheck
              label="Pagas"
              checked={filters.includePaid}
              onChange={(includePaid) => patch({ includePaid })}
            />
            <StatusCheck
              label="Abertas"
              checked={filters.includeOpen}
              onChange={(includeOpen) => patch({ includeOpen })}
            />
            <StatusCheck
              label="Vencidas"
              checked={filters.includeOverdue}
              onChange={(includeOverdue) => patch({ includeOverdue })}
            />
          </div>
        </fieldset>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Vencimento</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">Descrição</th>
                <th className="px-3 py-2.5">Parcelas</th>
                <th className="px-3 py-2.5">Situação</th>
                <th className="px-3 py-2.5 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                    Nenhuma conta neste filtro.
                  </td>
                </tr>
              ) : (
                rows.map((bill) => {
                  const tone = personalBillTone(bill.status, bill.dueDate);
                  const cls =
                    tone === 'paid'
                      ? 'bg-emerald-100 text-emerald-900'
                      : tone === 'overdue'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-950';
                  return (
                    <tr key={bill.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 tabular-nums">{formatCalendarDatePtBR(bill.dueDate)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{personalBillKindLabel(bill.category)}</td>
                      <td className="px-3 py-2.5">
                        <PersonalBillDescription kind={bill.category} description={bill.description} />
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">
                        {bill.installmentIndex && bill.installmentCount
                          ? `${bill.installmentIndex} de ${bill.installmentCount}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                          {personalBillToneLabel(tone)}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                        {formatBrl(Number(bill.amount))}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AdminShell>
  );
}

function StatusCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
