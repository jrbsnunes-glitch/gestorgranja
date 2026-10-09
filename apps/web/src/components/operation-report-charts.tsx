'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type ReportSection = {
  id: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
};

const BARN_COLORS = ['#0f766e', '#0369a1', '#7c3aed', '#c2410c', '#b45309', '#be123c'];

function shortDateLabel(raw: string) {
  const s = String(raw);
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s.slice(0, 5);
  return s.length > 8 ? s.slice(0, 8) : s;
}

export function OperationReportCharts({ sections }: { sections: ReportSection[] }) {
  const evolution = sections.find((s) => s.id === 'evolution');
  const comparison = sections.find((s) => s.id === 'comparison');
  const byBarn = sections.find((s) => s.id === 'evolutionByBarn');

  const dailyChart = useMemo(
    () =>
      evolution?.rows.map((r) => ({
        label: shortDateLabel(String(r.dateLabel ?? '')),
        commercial: Number(r.commercial) || 0,
        produced: Number(r.produced) || 0,
      })) ?? [],
    [evolution],
  );

  const barnTotalsChart = useMemo(
    () =>
      comparison?.rows.map((r) => ({
        name: String(r.code),
        commercial: Number(r.commercial) || 0,
      })) ?? [],
    [comparison],
  );

  const barnEvolution = useMemo(() => {
    if (!byBarn) return { data: [] as Record<string, string | number>[], series: [] as { key: string; label: string }[] };
    const series = byBarn.columns.filter((c) => c.key.startsWith('barn_'));
    const data = byBarn.rows.map((row) => {
      const point: Record<string, string | number> = {
        label: shortDateLabel(String(row.dateLabel ?? '')),
      };
      for (const col of series) {
        point[col.key] = Number(row[col.key]) || 0;
      }
      return point;
    });
    return { data, series: series.map((c) => ({ key: c.key, label: c.label })) };
  }, [byBarn]);

  const hasAny =
    dailyChart.some((d) => d.commercial > 0 || d.produced > 0) ||
    barnTotalsChart.some((b) => b.commercial > 0) ||
    barnEvolution.data.some((row) => barnEvolution.series.some((s) => Number(row[s.key]) > 0));

  if (!hasAny) {
    return (
      <p className="text-sm text-slate-500">Sem dados numéricos no período para exibir gráficos.</p>
    );
  }

  return (
    <div className="grid gap-6 print:gap-4 lg:grid-cols-2">
      {dailyChart.length > 0 ? (
        <div className="h-72 rounded-md border border-slate-200 bg-white p-3 print:h-64 lg:col-span-2">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Evolução diária — comerciais e produzidos
          </p>
          <ResponsiveContainer width="100%" height="92%">
            <LineChart data={dailyChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" />
              <YAxis fontSize={10} width={48} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="commercial" name="Comerciais" stroke="#0f766e" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="produced" name="Produzidos" stroke="#64748b" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {barnTotalsChart.length > 0 ? (
        <div className="h-72 rounded-md border border-slate-200 bg-white p-3 print:h-64">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Comparativo — comerciais por galpão
          </p>
          <ResponsiveContainer width="100%" height="92%">
            <BarChart data={barnTotalsChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" fontSize={10} />
              <YAxis fontSize={10} width={48} />
              <Tooltip />
              <Bar dataKey="commercial" name="Comerciais" fill="#166534" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      {barnEvolution.series.length > 0 && barnEvolution.data.length > 0 ? (
        <div
          className={`h-72 rounded-md border border-slate-200 bg-white p-3 print:h-64 ${barnTotalsChart.length === 0 ? 'lg:col-span-2' : ''}`}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
            Evolução — comerciais por galpão
          </p>
          <ResponsiveContainer width="100%" height="92%">
            <LineChart data={barnEvolution.data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" />
              <YAxis fontSize={10} width={48} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {barnEvolution.series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={BARN_COLORS[i % BARN_COLORS.length]}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </div>
  );
}
