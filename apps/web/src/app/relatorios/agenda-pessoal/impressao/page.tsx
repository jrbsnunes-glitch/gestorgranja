'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PersonalBillDescription } from '@/components/agenda/personal-bill-kind';
import { PersonalAgendaTotalsBox } from '@/components/agenda/personal-agenda-totals';
import { ReportPrintActions } from '@/components/report-print-actions';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';
import {
  filterPersonalAgendaBills,
  parsePersonalAgendaReportQuery,
  personalAgendaReportTotals,
  personalBillKindLabel,
  personalBillTone,
  personalBillToneLabel,
  type PersonalAgendaReportBill,
} from '@/lib/personal-agenda-report';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

function PrintBody() {
  const sp = useSearchParams();
  const filters = useMemo(() => parsePersonalAgendaReportQuery(sp), [sp]);
  const [items, setItems] = useState<PersonalAgendaReportBill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void apiFetch<{ items: PersonalAgendaReportBill[] }>('/v1/personal-agenda')
      .then((data) => setItems(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => filterPersonalAgendaBills(items, filters), [items, filters]);
  const totals = useMemo(() => personalAgendaReportTotals(rows), [rows]);
  useReportAutoPrint(!loading && !error);

  const periodText =
    filters.from || filters.to
      ? `${filters.from ? formatCalendarDatePtBR(filters.from) : '…'} a ${filters.to ? formatCalendarDatePtBR(filters.to) : '…'}`
      : 'Todo o período';
  const typeText = filters.category ? personalBillKindLabel(filters.category) : 'Todos os tipos';

  return (
    <div className="mx-auto max-w-6xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle="Relatório da agenda pessoal"
        documentExtras={
          <p className="mt-1 text-sm text-slate-600">
            Período: {periodText} · Tipo: {typeText} · {rows.length} conta(s). Estes lançamentos não afetam o caixa da granja.
          </p>
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {!loading && !error ? (
        <>
          <PersonalAgendaTotalsBox totals={totals} />
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Vencimento</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Descrição</th>
                <th className="py-2 pr-2">Parcelas</th>
                <th className="py-2 pr-2">Situação</th>
                <th className="py-2 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Nenhuma conta encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                rows.map((bill) => (
                  <tr key={bill.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 whitespace-nowrap">{formatCalendarDatePtBR(bill.dueDate)}</td>
                    <td className="py-2 pr-2">{personalBillKindLabel(bill.category)}</td>
                    <td className="py-2 pr-2">
                      <PersonalBillDescription kind={bill.category} description={bill.description} />
                    </td>
                    <td className="py-2 pr-2">
                      {bill.installmentIndex && bill.installmentCount
                        ? `${bill.installmentIndex} de ${bill.installmentCount}`
                        : '—'}
                    </td>
                    <td className="py-2 pr-2">{personalBillToneLabel(personalBillTone(bill.status, bill.dueDate))}</td>
                    <td className="py-2 text-right tabular-nums">{formatBrl(Number(bill.amount))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}

export default function AgendaPessoalImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
