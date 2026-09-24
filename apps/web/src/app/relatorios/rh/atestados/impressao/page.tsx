'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import {
  buildHrLeavesReportApiPath,
  type HrLeavesReportFilters,
  type HrLeavesReportVariant,
} from '@/lib/hr-leaves-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type LeaveRow = {
  id: string;
  controlNumber: number;
  type: string;
  startsAt: string;
  endsAt: string;
  days: number;
  cidCode: string | null;
  notes: string | null;
  employeeName: string;
  jobTitle: string | null;
  cpf: string | null;
};

type ReportPayload = {
  variant: HrLeavesReportVariant;
  period: { from: string | null; to: string | null };
  filters: {
    jobTitle: string | null;
    jobTitleLabel: string | null;
    leaveId: string | null;
  };
  totals: { count: number; totalDays: number };
  espelho: LeaveRow | null;
  rows: LeaveRow[] | null;
};

function parseFilters(sp: URLSearchParams): HrLeavesReportFilters | null {
  const variant = sp.get('variant');
  if (variant !== 'espelho' && variant !== 'listagem') return null;
  return {
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    jobTitle: sp.get('jobTitle') ?? '',
    leaveId: sp.get('leaveId') ?? '',
  };
}

function fmtDate(iso: string) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR');
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'RH — Atestados';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Atestados.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildHrLeavesReportApiPath(filters))
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
                <td className="py-2 pr-4 font-medium text-slate-600">Tipo</td>
                <td className="py-2">{labelEnum(data.espelho.type)}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">Período do afastamento</td>
                <td className="py-2">
                  {fmtDate(data.espelho.startsAt)} a {fmtDate(data.espelho.endsAt)} ({data.espelho.days}{' '}
                  dia(s))
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-2 pr-4 font-medium text-slate-600">CID</td>
                <td className="py-2">{data.espelho.cidCode ?? '—'}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-medium text-slate-600 align-top">Observações</td>
                <td className="py-2">{data.espelho.notes ?? '—'}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-slate-500">Atestado não encontrado.</p>
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
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2">Início</th>
                <th className="py-2 pr-2">Fim</th>
                <th className="py-2 pr-2 text-right">Dias</th>
                <th className="py-2 pr-2">CID</th>
              </tr>
            </thead>
            <tbody>
              {!data.rows?.length ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Nenhum atestado encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                    <td className="py-2 pr-2">{r.employeeName}</td>
                    <td className="py-2 pr-2">{r.jobTitle ?? '—'}</td>
                    <td className="py-2 pr-2">{labelEnum(r.type)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(r.startsAt)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDate(r.endsAt)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.days}</td>
                    <td className="py-2 pr-2">{r.cidCode ?? '—'}</td>
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

export default function HrLeavesReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
