'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { OperationReportCharts } from '@/components/operation-report-charts';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { buildOperationProductionReportApiPath } from '@/lib/operation-production-report';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type ReportSection = {
  id: string;
  heading: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  barnLegend?: string[];
};

type ReportPayload = {
  title: string;
  period: { from: string; to: string; fromLabel: string; toLabel: string };
  totals: {
    commercialFmt: string;
    producedFmt: string;
    layRatePctFmt: string;
    barns: number;
    lots: number;
  };
  sections: ReportSection[];
};

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório operacional';
  const from = sp.get('from') ?? '';
  const to = sp.get('to') ?? '';
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  const filters = useMemo(() => ({ from, to }), [from, to]);

  useEffect(() => {
    if (!from || !to) {
      setError('Informe o período na tela de relatórios da Operação.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildOperationProductionReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters, from, to]);

  useReportAutoPrint(!loading && !error && data != null, rootRef, 900);

  const subtitle = useMemo(() => {
    if (!data) return null;
    const t = data.totals;
    return (
      <p className="mt-1 text-sm text-slate-600">
        Período: {formatCalendarDatePtBR(data.period.from)} a {formatCalendarDatePtBR(data.period.to)} · {t.barns}{' '}
        galpão(ões) · {t.lots} lote(s) · {t.commercialFmt} comerciais · postura média {t.layRatePctFmt}
      </p>
    );
  }, [data]);

  return (
    <div className="report-print-surface mx-auto max-w-6xl bg-white p-6 print:p-0">
      <ReportPrintActions />

      <StandardReportHeader documentTitle={title} documentExtras={subtitle} />

      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data && !loading && !error ? (
        <div ref={rootRef} className="space-y-8">
          {data.sections.map((section) => (
            <section key={section.id} className="break-inside-avoid">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700">{section.heading}</h2>
              {section.barnLegend?.length ? (
                <p className="mb-2 text-xs text-slate-500">{section.barnLegend.join(' · ')}</p>
              ) : null}
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
                    {section.columns.map((c) => (
                      <th key={c.key} className="py-2 pr-2">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.length === 0 ? (
                    <tr>
                      <td colSpan={section.columns.length} className="py-4 text-slate-500">
                        Nenhum registro no período.
                      </td>
                    </tr>
                  ) : (
                    section.rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        {section.columns.map((c) => (
                          <td key={c.key} className="py-1.5 pr-2 align-top tabular-nums">
                            {row[c.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </section>
          ))}

          <section className="break-before-page break-inside-avoid print:pt-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-700">Gráficos</h2>
            <OperationReportCharts sections={data.sections} />
            <p className="mt-3 text-xs text-slate-500 print:text-[10px]">
              Os gráficos usam os mesmos totais das tabelas acima. Na impressão, aguarde o carregamento visual antes de
              confirmar o PDF.
            </p>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export default function OperacaoImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
