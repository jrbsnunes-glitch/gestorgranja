'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type StubReport = {
  title: string;
  reportKey: string;
  from: string;
  to: string;
  min: number | null;
  max: number | null;
  generatedAt: string;
  companyName: string;
  rows: { label: string; value: string }[];
};

function StubPrintBody() {
  const sp = useSearchParams();
  const reportKey = sp.get('key') ?? 'generic';
  const title = sp.get('title') ?? 'Relatório';
  const qs = useMemo(() => sp.toString(), [sp]);
  const [data, setData] = useState<StubReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams(qs);
    q.delete('key');
    q.delete('title');
    q.delete('module');
    void apiFetch<StubReport>(`/v1/reports/stub/${encodeURIComponent(reportKey)}?${q}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [reportKey, qs]);

  useReportAutoPrint(!loading && !error && data != null);

  return (
    <div className="mx-auto max-w-4xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle={title}
        documentExtras={
          data ? (
            <p className="mt-1 text-sm text-slate-600">
              Período: {data.from || '—'} a {data.to || '—'}
              {data.min != null || data.max != null
                ? ` · Controle ${data.min ?? '—'} a ${data.max ?? '—'}`
                : ''}
            </p>
          ) : null
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
              <th className="py-2 pr-2">Item</th>
              <th className="py-2">Valor</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2 pr-2">{r.label}</td>
                <td className="py-2">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

export default function StubImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <StubPrintBody />
    </Suspense>
  );
}
