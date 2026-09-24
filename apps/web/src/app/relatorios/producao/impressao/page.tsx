'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import {
  buildProductionReportApiPath,
  type ProductionReportDomain,
  type ProductionReportFilters,
  type ProductionReportVariant,
} from '@/lib/production-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type ReportPayload = {
  title: string;
  domain: ProductionReportDomain;
  variant: ProductionReportVariant;
  period: { from: string | null; to: string | null };
  flockLotCode: string | null;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  footer?: Record<string, string | number> | null;
};

function parseFilters(sp: URLSearchParams): ProductionReportFilters | null {
  const domain = sp.get('domain');
  const variant = sp.get('variant');
  if (
    domain !== 'postura' &&
    domain !== 'mortalidade' &&
    domain !== 'racao' &&
    domain !== 'ambiente' &&
    domain !== 'transferencia'
  ) {
    return null;
  }
  if (variant !== 'geral' && variant !== 'periodo' && variant !== 'lote' && variant !== 'totais') {
    return null;
  }
  return {
    domain,
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    flockLotId: sp.get('flockLotId') ?? '',
  };
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório de produção';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Produção.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildProductionReportApiPath(filters))
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
    } else if (data.period.from) {
      parts.push(`A partir de ${data.period.from}`);
    } else if (data.period.to) {
      parts.push(`Até ${data.period.to}`);
    }
    if (data.flockLotCode) parts.push(`Lote ${data.flockLotCode}`);
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
    </div>
  );
}

export default function ProducaoImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
