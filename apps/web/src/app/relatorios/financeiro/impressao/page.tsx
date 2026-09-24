'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import {
  buildFinanceTitlesReportApiPath,
  FINANCE_TITLE_BUCKET_LABELS,
  type FinanceTitleKind,
  type FinanceTitlesReportFilters,
} from '@/lib/finance-titles-report-query';
import { apiFetch } from '@/lib/api';
import { ReportPrintActions } from '@/components/report-print-actions';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type ReportRow = {
  controlNumber: number;
  description: string;
  partnerName: string;
  dueDate: string;
  amount: number;
  amountPaid: number;
  balance: number;
  chartAccount: string;
  buckets: string[];
};

type ReportPayload = {
  kind: FinanceTitleKind;
  period: { from: string | null; to: string | null };
  rows: ReportRow[];
};

function parseFilters(sp: URLSearchParams): FinanceTitlesReportFilters | null {
  const kind = sp.get('kind');
  if (kind !== 'payable' && kind !== 'receivable') return null;
  const bool = (key: string) => sp.get(key) !== '0';
  return {
    kind,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    controlMin: sp.get('controlMin') ?? '',
    controlMax: sp.get('controlMax') ?? '',
    partnerId: sp.get('partnerId') ?? '',
    includeOpen: bool('includeOpen'),
    includeSettled: bool('includeSettled'),
    includePartialPayment: bool('includePartialPayment'),
    includePartialOpen: bool('includePartialOpen'),
  };
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório financeiro';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Financeiro.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildFinanceTitlesReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const totals = useMemo(() => {
    if (!data?.rows.length) return { amount: 0, paid: 0, balance: 0 };
    return data.rows.reduce(
      (acc, r) => ({
        amount: acc.amount + r.amount,
        paid: acc.paid + r.amountPaid,
        balance: acc.balance + r.balance,
      }),
      { amount: 0, paid: 0, balance: 0 },
    );
  }, [data]);

  const periodText =
    data?.period.from || data?.period.to
      ? `${data.period.from ?? '…'} a ${data.period.to ?? '…'} (vencimento)`
      : 'Todo o período (vencimento)';

  return (
    <div className="mx-auto max-w-6xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle={title}
        documentExtras={
          <p className="mt-1 text-sm text-slate-600">
            Período: {periodText}
            {data?.rows ? ` · ${data.rows.length} título(s)` : null}
          </p>
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                  <th className="py-2 pr-2">Controle</th>
                  <th className="py-2 pr-2">Descrição</th>
                  <th className="py-2 pr-2">Parceiro</th>
                  <th className="py-2 pr-2">Venc.</th>
                  <th className="py-2 pr-2 text-right">Valor</th>
                  <th className="py-2 pr-2 text-right">Pago/rec.</th>
                  <th className="py-2 pr-2 text-right">Saldo</th>
                  <th className="py-2">Situação</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500">
                      Nenhum título encontrado com os filtros informados.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r) => (
                    <tr key={r.controlNumber} className="border-b border-slate-100">
                      <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                      <td className="py-2 pr-2">{r.description}</td>
                      <td className="py-2 pr-2">{r.partnerName}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">
                        {new Date(r.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.amount)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.amountPaid)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.balance)}</td>
                      <td className="py-2 text-xs text-slate-700">
                        {r.buckets.map((b) => FINANCE_TITLE_BUCKET_LABELS[b] ?? b).join(', ')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {data.rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-300 font-medium">
                    <td colSpan={4} className="py-2 pr-2 text-right">
                      Totais
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(totals.amount)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(totals.paid)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(totals.balance)}</td>
                    <td />
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function FinanceiroImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
