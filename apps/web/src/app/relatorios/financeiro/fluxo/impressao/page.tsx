'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type CashFlow = {
  period: { from: string; to: string };
  kindFilter?: string | null;
  openingBalance: number;
  closingBalance: number;
  totals: { inflow: number; outflow: number };
  rows: { date: string; kind: string; description: string; inflow: number; outflow: number; balance: number; projected: boolean }[];
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Body() {
  const sp = useSearchParams();
  const qs = useMemo(() => sp.toString(), [sp]);
  const kindLabel = sp.get('kind');
  const [data, setData] = useState<CashFlow | null>(null);

  useEffect(() => {
    void apiFetch<CashFlow>(`/v1/finance/cash-flow?${qs}`).then(setData);
  }, [qs]);

  useReportAutoPrint(data != null);

  return (
    <div className="mx-auto max-w-5xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle="Fluxo de caixa"
        documentExtras={
          data ? (
            <p>
              Período {data.period.from} a {data.period.to}
              {kindLabel ? ` — Tipo: ${kindLabel}` : ''}
              {' — '}
              Abertura {fmt(data.openingBalance)}
            </p>
          ) : null
        }
      />
      {data ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-slate-500">
              <th className="py-2">Data</th>
              <th>Tipo</th>
              <th>Descrição</th>
              <th className="text-right">Entrada</th>
              <th className="text-right">Saída</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className={`border-b border-slate-100 ${r.projected ? 'text-slate-500 italic' : ''}`}>
                <td className="py-1">{r.date}</td>
                <td>{r.kind}</td>
                <td>{r.description}</td>
                <td className="text-right">{r.inflow ? fmt(r.inflow) : '—'}</td>
                <td className="text-right">{r.outflow ? fmt(r.outflow) : '—'}</td>
                <td className="text-right">{fmt(r.balance)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-800 font-semibold">
              <td colSpan={3} className="py-2">
                Totais do período
              </td>
              <td className="text-right">{fmt(data.totals.inflow)}</td>
              <td className="text-right">{fmt(data.totals.outflow)}</td>
              <td className="text-right">{fmt(data.closingBalance)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="text-sm">Carregando…</p>
      )}
    </div>
  );
}

export default function FluxoImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <Body />
    </Suspense>
  );
}
