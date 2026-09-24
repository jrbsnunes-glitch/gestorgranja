'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import {
  buildHrEmployeesReportApiPath,
  HR_EMPLOYEES_SORT_OPTIONS,
  type HrEmployeesReportFilters,
  type HrEmployeesReportSort,
} from '@/lib/hr-employees-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type ReportRow = {
  controlNumber: number;
  name: string;
  cpf: string | null;
  jobTitle: string | null;
  baseSalary: number;
  irrfDependents: number;
  hiredAt: string | null;
  isActive: boolean;
  username: string | null;
};

type ReportPayload = {
  variant: 'listagem_geral';
  sort: HrEmployeesReportSort;
  filters: { controlMin: number | null; controlMax: number | null };
  totals: { count: number; activeCount: number; totalSalary: number };
  rows: ReportRow[];
};

function parseFilters(sp: URLSearchParams): HrEmployeesReportFilters | null {
  const variant = sp.get('variant');
  const sort = sp.get('sort');
  const sorts: HrEmployeesReportSort[] = ['controle', 'nome', 'salario_asc', 'salario_desc'];
  if (variant !== 'listagem_geral' || !sort || !sorts.includes(sort as HrEmployeesReportSort)) {
    return null;
  }
  return {
    variant: 'listagem_geral',
    controlMin: sp.get('controlMin') ?? '',
    controlMax: sp.get('controlMax') ?? '',
    sort: sort as HrEmployeesReportSort,
  };
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'RH — Funcionários';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Funcionários.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildHrEmployeesReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const sortLabel = HR_EMPLOYEES_SORT_OPTIONS.find((o) => o.id === data?.sort)?.label ?? '';

  const filterExtras = useMemo(() => {
    if (!data) return '';
    const parts: string[] = [];
    if (sortLabel) parts.push(`Ordenação: ${sortLabel}`);
    if (data.filters.controlMin != null || data.filters.controlMax != null) {
      parts.push(
        `Controle ${data.filters.controlMin ?? '…'} a ${data.filters.controlMax ?? '…'}`,
      );
    }
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }, [data, sortLabel]);

  return (
    <div className="mx-auto max-w-6xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle={title}
        documentExtras={
          <p className="mt-1 text-sm text-slate-600">
            Listagem geral
            {filterExtras}
            {data?.totals ? ` · ${data.totals.count} funcionário(s)` : null}
          </p>
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Controle</th>
                <th className="py-2 pr-2">Nome</th>
                <th className="py-2 pr-2">CPF</th>
                <th className="py-2 pr-2">Cargo</th>
                <th className="py-2 pr-2 text-right">Salário base</th>
                <th className="py-2 pr-2">Admissão</th>
                <th className="py-2 pr-2">Usuário</th>
                <th className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Nenhum funcionário encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.controlNumber} className="border-b border-slate-100">
                    <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                    <td className="py-2 pr-2">{r.name}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{r.cpf ?? '—'}</td>
                    <td className="py-2 pr-2">{r.jobTitle ?? '—'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.baseSalary)}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {r.hiredAt
                        ? new Date(r.hiredAt + 'T12:00:00').toLocaleDateString('pt-BR')
                        : '—'}
                    </td>
                    <td className="py-2 pr-2">{r.username ?? '—'}</td>
                    <td className="py-2">{r.isActive ? 'Ativo' : 'Inativo'}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td colSpan={4} className="py-2 pr-2 text-right">
                    Totais ({data.totals.activeCount} ativo(s))
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(data.totals.totalSalary)}</td>
                  <td colSpan={3} className="py-2 text-right text-xs text-slate-600">
                    Soma dos salários base listados
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function HrEmployeesReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
