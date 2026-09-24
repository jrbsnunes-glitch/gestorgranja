'use client';

import { Suspense, useEffect, useState } from 'react';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type Aging = {
  buckets: { current: number; d1_30: number; d31_60: number; d61_90: number; d90plus: number };
  rows: { controlNumber: number; partnerName: string; dueDate: string; balance: number; bucket: string; overdueDays: number }[];
};

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function AgingBody() {
  const [data, setData] = useState<Aging | null>(null);

  useEffect(() => {
    void apiFetch<Aging>('/v1/reports/receivable-aging').then(setData);
  }, []);

  useReportAutoPrint(data != null);

  return (
    <div className="mx-auto max-w-5xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader documentTitle="Aging — contas a receber" />
      {data ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
            <p>A vencer: {fmt(data.buckets.current)}</p>
            <p>1–30: {fmt(data.buckets.d1_30)}</p>
            <p>31–60: {fmt(data.buckets.d31_60)}</p>
            <p>61–90: {fmt(data.buckets.d61_90)}</p>
            <p>90+: {fmt(data.buckets.d90plus)}</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase text-slate-500">
                <th className="py-2">Controle</th>
                <th>Cliente</th>
                <th>Venc.</th>
                <th>Faixa</th>
                <th className="text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.controlNumber} className="border-b border-slate-100">
                  <td className="py-1">{r.controlNumber}</td>
                  <td>{r.partnerName}</td>
                  <td>{r.dueDate}</td>
                  <td>{r.bucket}</td>
                  <td className="text-right">{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p>Carregando…</p>
      )}
    </div>
  );
}

export default function AgingImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <AgingBody />
    </Suspense>
  );
}
