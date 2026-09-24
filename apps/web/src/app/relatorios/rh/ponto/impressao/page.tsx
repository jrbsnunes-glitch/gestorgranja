'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { buildHrPunchReportApiPath, type HrPunchReportFilters } from '@/lib/hr-punch-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type PunchDayPair = {
  inAt: string | null;
  outAt: string | null;
  minutes: number | null;
  note: string | null;
};

type EmployeeMirror = {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  days: {
    date: string;
    pairs: PunchDayPair[];
    totalMinutes: number;
    hasIncomplete: boolean;
  }[];
  totalMinutes: number;
};

type ReportPayload = {
  title: string;
  companyName: string;
  from: string;
  to: string;
  generatedAt: string;
  employees: EmployeeMirror[];
  totals: { employees: number; punches: number; minutes: number; hoursLabel: string };
};

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function fmtDayMinutes(min: number) {
  const h = Math.floor(min / 60);
  const mi = min % 60;
  return `${h}h${String(mi).padStart(2, '0')}`;
}

function PrintBody() {
  const sp = useSearchParams();
  const filters = useMemo(
    (): HrPunchReportFilters => ({
      from: sp.get('from') ?? '',
      to: sp.get('to') ?? '',
    }),
    [sp],
  );
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildHrPunchReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  return (
    <div className="mx-auto max-w-4xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle="Espelho de ponto"
        documentExtras={
          data ? (
            <p className="mt-1 text-sm text-slate-600">
              {data.companyName} · Período {data.from || '—'} a {data.to || '—'}
              {data.totals
                ? ` · ${data.totals.employees} colaborador(es) · ${data.totals.hoursLabel} totais`
                : ''}
            </p>
          ) : null
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error ? (
        <div className="space-y-8">
          {data.employees.length === 0 ? (
            <p className="text-sm text-slate-600">Nenhuma batida no período.</p>
          ) : (
            data.employees.map((emp) => (
              <section key={emp.employeeId} className="break-inside-avoid">
                <h2 className="border-b border-slate-300 pb-1 text-base font-semibold text-slate-900">
                  {emp.employeeName}
                  {emp.jobTitle ? ` · ${emp.jobTitle}` : ''}
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    Total: {fmtDayMinutes(emp.totalMinutes)}
                  </span>
                </h2>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-600">
                      <th className="py-1 pr-2">Data</th>
                      <th className="py-1 pr-2">Entrada</th>
                      <th className="py-1 pr-2">Saída</th>
                      <th className="py-1 pr-2">Horas</th>
                      <th className="py-1">Obs.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emp.days.flatMap((day) =>
                      day.pairs.map((pair, idx) => (
                        <tr key={`${day.date}-${idx}`} className="border-b border-slate-100">
                          <td className="py-1 pr-2 tabular-nums">{idx === 0 ? fmtDate(day.date) : ''}</td>
                          <td className="py-1 pr-2 tabular-nums">{pair.inAt ?? '—'}</td>
                          <td className="py-1 pr-2 tabular-nums">{pair.outAt ?? '—'}</td>
                          <td className="py-1 pr-2 tabular-nums">
                            {pair.minutes != null ? fmtDayMinutes(pair.minutes) : '—'}
                          </td>
                          <td className="py-1 text-xs text-amber-800">{pair.note ?? ''}</td>
                        </tr>
                      )),
                    )}
                  </tbody>
                </table>
              </section>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function PontoImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
