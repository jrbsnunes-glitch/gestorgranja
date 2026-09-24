'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import {
  buildProductsReportApiPath,
  type ProductsReportFilters,
  type ProductsReportVariant,
} from '@/lib/products-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type EggPackagingSummaryBlock = {
  title: string;
  note?: string;
  lines: { label: string; value: string }[];
};

type ReportPayload = {
  title: string;
  variant: ProductsReportVariant;
  period: { from: string | null; to: string | null };
  stockLocations: string[] | null;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  footer?: Record<string, string | number> | null;
  eggPackagingSummary?: EggPackagingSummaryBlock | null;
};

function parseFilters(sp: URLSearchParams): ProductsReportFilters | null {
  const variant = sp.get('variant');
  if (
    variant !== 'geral' &&
    variant !== 'saldo_fisico' &&
    variant !== 'saldo_financeiro' &&
    variant !== 'giro'
  ) {
    return null;
  }
  const stockLocationIds = (sp.get('stockLocationIds') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    stockLocationIds,
  };
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório de produtos';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Produtos.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildProductsReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const subtitle = useMemo(() => {
    if (!data) return null;
    const parts: string[] = [];
    if (data.period.from && data.period.to) {
      parts.push(`Período: ${data.period.from} a ${data.period.to}`);
    }
    if (data.stockLocations?.length) {
      parts.push(`Locais: ${data.stockLocations.join(' · ')}`);
    }
    if (parts.length === 0) return null;
    return <p className="mt-1 text-sm text-slate-600">{parts.join(' · ')}</p>;
  }, [data]);

  return (
    <div className="report-print-surface mx-auto max-w-5xl bg-white p-6 print:p-0">
      <ReportPrintActions />

      <StandardReportHeader documentTitle={title} documentExtras={subtitle} />

      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data && !loading && !error ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
              {data.columns.map((c) => (
                <th key={c.key} className="py-2 pr-2">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="py-4 text-slate-500">
                  Nenhum registro no filtro informado.
                </td>
              </tr>
            ) : (
              data.rows.map((row, i) => (
                <tr key={i} className="border-b border-slate-100">
                  {data.columns.map((c) => (
                    <td key={c.key} className="py-1.5 pr-2 align-top">
                      {row[c.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {data.footer ? (
            <tfoot className="print:bg-white">
              <tr className="border-t-2 border-slate-400 bg-slate-50 font-semibold text-slate-900 print:bg-white">
                {data.columns.map((c) => (
                  <td key={c.key} className="py-2 pr-2 align-top">
                    {data.footer![c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      ) : null}

      {data?.eggPackagingSummary && data.eggPackagingSummary.lines.length > 0 ? (
        <section className="mt-6 rounded-md border border-teal-200 bg-teal-50/80 p-4 print:border-slate-300 print:bg-white">
          <h2 className="text-sm font-semibold text-teal-900">{data.eggPackagingSummary.title}</h2>
          {data.eggPackagingSummary.note ? (
            <p className="mt-1 text-xs text-slate-600">{data.eggPackagingSummary.note}</p>
          ) : null}
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.eggPackagingSummary.lines.map((line) => (
              <div key={line.label} className="flex flex-col gap-0.5 text-sm">
                <dt className="text-xs uppercase tracking-wide text-slate-500">{line.label}</dt>
                <dd className="font-medium text-slate-900">{line.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {data?.eggPackagingSummary && data.eggPackagingSummary.lines.length === 0 && data.eggPackagingSummary.note ? (
        <p className="mt-4 text-xs text-slate-600">{data.eggPackagingSummary.note}</p>
      ) : null}
    </div>
  );
}

export default function ProdutosImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
