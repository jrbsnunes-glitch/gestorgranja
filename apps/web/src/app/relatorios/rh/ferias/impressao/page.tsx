'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import {
  buildHrVacationsReportApiPath,
  type HrVacationsReportFilters,
  type HrVacationsReportVariant,
} from '@/lib/hr-vacations-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type VacationRow = {
  id: string;
  controlNumber: number;
  acquisitionYear: number;
  status: string;
  startsAt: string;
  endsAt: string;
  days: number;
  employeeName: string;
  jobTitle: string | null;
  cpf: string | null;
};

type ReportPayload = {
  variant: HrVacationsReportVariant;
  period: { from: string | null; to: string | null };
  filters: {
    jobTitle: string | null;
    jobTitleLabel: string | null;
    vacationId: string | null;
  };
  totals: { count: number; totalDays: number };
  espelho: VacationRow | null;
  rows: VacationRow[] | null;
};

function parseFilters(sp: URLSearchParams): HrVacationsReportFilters | null {
  const variant = sp.get('variant');
  if (variant !== 'espelho' && variant !== 'listagem') return null;
  return {
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    jobTitle: sp.get('jobTitle') ?? '',
    vacationId: sp.get('vacationId') ?? '',
  };
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'RH — Férias';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Férias.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildHrVacationsReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const headerExtras = useMemo(() => {
    if (!data) return null;
    if (data.variant === 'espelho' && data.espelho) {
      return (
        <p className="mt-1 text-sm text-slate-600">
          Controle {data.espelho.controlNumber} · {data.espelho.employeeName}
        </p>
      );
    }
    const parts: string[] = [];
    if (data.period.from || data.period.to) {
      parts.push(`Período ${data.period.from ?? '…'} a ${data.period.to ?? '…'}`);
    }
    if (data.filters.jobTitleLabel) parts.push(`Cargo: ${data.filters.jobTitleLabel}`);
    return (
      <p className="mt-1 text-sm text-slate-600">
        {parts.join(' · ') || 'Listagem geral'}
        {data.totals ? ` · ${data.totals.count} registro(s)` : null}
      </p>
    );
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader documentTitle={title} documentExtras={headerExtras} />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data && !loading && !error && data.variant === 'espelho' ? (
        data.espelho ? (
          <table className="w-full max-w-xl border-collapse text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">Controle</td>
                <td className="py-2 tabular-nums">{data.espelho.controlNumber}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">Funcionário</td>
                <td className="py-2">{data.espelho.employeeName}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">Cargo</td>
                <td className="py-2">{data.espelho.jobTitle ?? '—'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">CPF</td>
                <td className="py-2">{data.espelho.cpf ?? '—'}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">Ano aquisitivo</td>
                <td className="py-2 tabular-nums">{data.espelho.acquisitionYear}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">Status</td>
                <td className="py-2">{labelEnum(data.espelho.status)}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600">Período de gozo</td>
                <td className="py-2">
                  {fmtDate(data.espelho.startsAt)} a {fmtDate(data.espelho.endsAt)} ({data.espelho.days}{' '}
                  dia(s))
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Programação não encontrada.</p>
        )
      ) : null}

      {data && !loading && !error && data.variant === 'listagem' ? (
        <div className="overflow-x-hidden print:overflow-visible">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Controle</th>
                <th className="py-2 pr-2">Funcionário</th>
                <th className="py-2 pr-2">Cargo</th>
                <th className="py-2 pr-2">Aquisitivo</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">Início</th>
                <th className="py-2 pr-2">Fim</th>
                <th className="py-2 pr-2 text-right">Dias</th>
              </tr>
            </thead>
            <tbody>
              {!data.rows?.length ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Nenhuma programação encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                    <td className="py-2 pr-2">{r.employeeName}</td>
                    <td className="py-2 pr-2">{r.jobTitle ?? '—'}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.acquisitionYear}</td>
                    <td className="py-2 pr-2">{labelEnum(r.status)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(r.startsAt)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(r.endsAt)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.days}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows && data.rows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td colSpan={6} className="py-2 pr-2 text-right">
                    Totais
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{data.totals.totalDays}</td>
                  <td className="py-2 text-xs text-slate-600">{data.totals.count} registro(s)</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function HrVacationsReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
