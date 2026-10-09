'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
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
import { Card } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { IllustratedKpi } from '@/components/dashboard/illustrated-kpi';
import { Kpi } from '@/components/dashboard/kpi-card';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ErrorBox, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { labelEnum } from '@/lib/labels';
import { formatBrl } from '@/lib/money';
import { OPERACAO_DASHBOARD_KPI_ICONS } from '@/lib/operacao-tab-icons';
import { lotLabel, todayIso, useBarnOptions, useLotOptions } from '@/lib/operation-options';

type Dashboard = {
  filters: { from: string; to: string; barnId: string | null; flockLotId: string | null };
  totals: {
    lots: number;
    barns: number;
    liveBirds: number;
    produced: number;
    commercial: number;
    formas: number;
    equivalentCartons: number;
    packagingBoxes: number;
    packagingLooseCartons: number;
    packagingRemainderEggs: number;
    lossEggs: number;
    lossPct: number | null;
    layRatePct: number | null;
    standardLayRatePct: number | null;
    mortality: number;
    mortalityPct: number | null;
    feedKg: number;
    feedGPerBirdDay: number | null;
    feedCost: number;
    costPerDozen: number | null;
    operationalLossCost: number;
    openOccurrences: number;
    criticalOccurrences: number;
    awaitingReview: number;
    daysWithData: number;
  };
  packaging?: { eggsPerForma: number; eggsPerCarton: number; cartonsPerBox: number; hint?: string };
  series: {
    date: string;
    produced: number;
    commercial: number;
    lossEggs: number;
    layRatePct: number | null;
    standardLayRatePct: number | null;
    mortality: number;
    feedKg: number;
    lotsRecorded: number;
  }[];
  byBarn: {
    barn: { id: string; code: string; name: string };
    lots: number;
    liveBirds: number;
    produced: number;
    commercial: number;
    layRatePct: number | null;
    lossPct: number | null;
    mortality: number;
    feedKg: number;
    openOccurrences: number;
  }[];
  byLot: {
    lot: { id: string; code: string; status: string };
    barn: { id: string; code: string; name: string };
    lineage: string;
    ageWeeks: number;
    liveBirds: number;
    produced: number;
    commercial: number;
    formas: number;
    equivalentCartons: number;
    packagingBoxes: number;
    packagingLooseCartons: number;
    packagingRemainderEggs: number;
    lossPct: number | null;
    layRatePct: number | null;
    standardLayRatePct: number | null;
    layGapPct: number | null;
    mortality: number;
    mortalityPct: number | null;
    feedKg: number;
    feedGPerBirdDay: number | null;
    feedConversion7d: number | null;
    costPerDozen: number | null;
  }[];
  losses: { type: string; quantity: number; cost: number; count: number }[];
  occurrences: { id: string; occurredAt: string; type: string; priority: string; status: string; description: string; barn: string | null; lot: string | null }[];
};

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const nf = (n: number | null | undefined, digits = 0) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const pf = (n: number | null | undefined, digits = 1) => (n == null ? '—' : `${nf(n, digits)}%`);

const LAY_GAP_PP_HINT =
  'Pontos percentuais (p.p.): postura média do lote no período menos o padrão da linhagem na idade atual. Não é “% a mais”; é a diferença direta (ex.: 95% − 90% = +5 p.p.).';

/** Cabeçalho de coluna com legenda ao passar o mouse (Δ p.p.). */
function TableHeaderHint({ label, hint, align = 'left' }: { label: string; hint: string; align?: 'left' | 'right' }) {
  const alignCls = align === 'right' ? 'right-0 text-right' : 'left-0 text-left';
  return (
    <span
      className="group/hint relative inline-block max-w-full cursor-help border-b border-dotted border-slate-400/90"
      title={hint}
      tabIndex={0}
    >
      {label}
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-[calc(100%+6px)] z-30 hidden w-56 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-slate-700 shadow-md group-hover/hint:block group-focus-within/hint:block ${alignCls}`}
      >
        {hint}
      </span>
    </span>
  );
}


export default function OperacaoDashboardPage() {
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(todayIso());
  const [barnId, setBarnId] = useState('');
  const [flockLotId, setFlockLotId] = useState('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const barns = useBarnOptions();
  const lots = useLotOptions();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ from, to });
    if (barnId) q.set('barnId', barnId);
    if (flockLotId) q.set('flockLotId', flockLotId);
    void apiFetch<Dashboard>(`/v1/operation/dashboard?${q.toString()}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [from, to, barnId, flockLotId]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;
  const chart = (data?.series ?? []).map((s) => ({
    ...s,
    label: s.date.slice(8, 10) + '/' + s.date.slice(5, 7),
  }));
  const gap = t?.layRatePct != null && t.standardLayRatePct != null ? t.layRatePct - t.standardLayRatePct : null;

  return (
    <AdminShell title="Painel geral">
      <PageIntro
        title="Painel geral"
        description="Visão da granja: aves vivas, ovos comerciais, postura e mortalidade. O detalhamento abaixo mantém ração, perdas e ocorrências."
      />
      <ErrorBox message={error} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          De
          <input type="date" className={`${inputClass} mt-1 w-40`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-slate-600">
          Até
          <input type="date" className={`${inputClass} mt-1 w-40`} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-xs text-slate-600">
          Galpão
          <select className={`${inputClass} mt-1 w-52`} value={barnId} onChange={(e) => { setBarnId(e.target.value); setFlockLotId(''); }}>
            <option value="">Todos</option>
            {barns.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Lote
          <select className={`${inputClass} mt-1 w-60`} value={flockLotId} onChange={(e) => setFlockLotId(e.target.value)}>
            <option value="">Todos</option>
            {lots
              .filter((l) => !barnId || l.barnId === barnId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {lotLabel(l)}
                </option>
              ))}
          </select>
        </label>
        <div className="flex gap-1 pb-1 text-xs">
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              type="button"
              className="rounded border px-2 py-1 hover:bg-slate-50"
              onClick={() => {
                setFrom(daysAgo(n - 1));
                setTo(todayIso());
              }}
            >
              {n} dias
            </button>
          ))}
        </div>
        {loading ? <span className="pb-2 text-xs text-slate-500">Atualizando…</span> : null}
      </div>

      {t ? (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <IllustratedKpi
              img={OPERACAO_DASHBOARD_KPI_ICONS.birds}
              label="Aves vivas"
              value={nf(t.liveBirds)}
              sub={`${t.lots} lote(s) · ${t.barns} galpão(ões)`}
            />
            <IllustratedKpi
              img="/producao/ovo.svg"
              label="Ovos comerciais"
              value={nf(t.commercial)}
              sub={chart.length ? `último dia ${nf(chart[chart.length - 1]?.commercial)}` : `${t.daysWithData} dia(s) com dado`}
            />
            <IllustratedKpi
              img="/producao/grafico.svg"
              label="Postura média"
              value={pf(t.layRatePct)}
              sub={t.standardLayRatePct != null ? `padrão ${pf(t.standardLayRatePct)}` : 'sem padrão da linhagem'}
            />
            <IllustratedKpi
              img={OPERACAO_DASHBOARD_KPI_ICONS.mortality}
              label="Mortalidade no período"
              value={nf(t.mortality)}
              sub={`${pf(t.mortalityPct, 2)} do alojado`}
            />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-5">
            <Card title="Produção de ovos (últimos 7 dias)" className="h-72 lg:col-span-3">
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={chart.slice(-7)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="commercial" name="Ovos comerciais" fill="#166534" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Produtividade" className="flex h-72 flex-col items-center justify-center lg:col-span-2">
              <p className="text-5xl font-semibold text-emerald-800">{pf(t.layRatePct, 0)}</p>
              <p className="mt-1 text-sm text-slate-500">postura média no período</p>
              <p className="mt-4 text-center text-sm text-slate-600">
                {nf(t.commercial)} ovos comerciais
                <br />
                {nf(t.produced)} produzidos no total
                <br />
                <span className="text-xs text-slate-500">
                  Embalagem: {nf(t.packagingBoxes)} caixa(s) + {nf(t.packagingLooseCartons)} cart. avulsa(s)
                </span>
              </p>
            </Card>
          </div>

          <Card title="Resumo por lote — produção no período" className="mb-6">
            <p className="mb-2 text-xs leading-relaxed text-slate-600">
              <strong>Formas (coleta):</strong> comerciais ÷ {data!.packaging?.eggsPerForma ?? 30} (bandeja).
              {' '}
              <strong>Caixas / cart. avulsas:</strong> mesma regra da postura que alimenta o estoque (
              {data!.packaging?.eggsPerCarton ?? 30} ovos/cartela, {data!.packaging?.cartonsPerBox ?? 12}{' '}
              cartelas/caixa).{' '}
              <Link href="/estoque" className="text-emerald-800 underline">
                Saldo físico no depósito
              </Link>{' '}
              está no Painel → Produtos e estoque (após vendas e saídas).
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">Lote</th>
                    <th className="px-2 py-1.5">Galpão</th>
                    <th className="px-2 py-1.5 text-right">Idade</th>
                    <th className="px-2 py-1.5 text-right">Aves vivas</th>
                    <th className="px-2 py-1.5 text-right">Formas</th>
                    <th className="px-2 py-1.5 text-right">Caixas</th>
                    <th className="px-2 py-1.5 text-right">Cart. avulsas</th>
                    <th className="px-2 py-1.5 text-right">Ovos produzidos</th>
                    <th className="px-2 py-1.5 text-right">Postura</th>
                    <th className="px-2 py-1.5 text-right">Mortalidade</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.byLot.map((l) => (
                    <tr key={l.lot.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <Link href={`/cadastros/lotes?lote=${l.lot.id}`} className="font-medium text-emerald-900 hover:underline">
                          {l.lot.code}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5">{l.barn.name}</td>
                      <td className="px-2 py-1.5 text-right">{l.ageWeeks} sem.</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.liveBirds)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.formas)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.packagingBoxes)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.packagingLooseCartons)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.produced)}</td>
                      <td className="px-2 py-1.5 text-right">{pf(l.layRatePct)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.mortality)}</td>
                      <td className="px-2 py-1.5">{labelEnum(l.lot.status)}</td>
                    </tr>
                  ))}
                  {!data!.byLot.length ? (
                    <tr>
                      <td colSpan={11} className="px-2 py-4 text-center text-slate-500">
                        Sem lotes no filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Detalhamento do período</h2>
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
            <Kpi label="Aves vivas" value={nf(t.liveBirds)} sub={`${t.lots} lote(s) · ${t.barns} galpão(ões)`} />
            <Kpi label="Ovos comerciais" value={nf(t.commercial)} sub={`${nf(t.produced)} produzidos · ${t.daysWithData} dia(s)`} />
            <Kpi
              label="Embalagem (período)"
              value={`${nf(t.packagingBoxes)} cx`}
              sub={`+ ${nf(t.packagingLooseCartons)} cart. avulsas · ${nf(t.equivalentCartons)} equiv. cartelas`}
            />
            <Kpi
              label="Postura média"
              value={pf(t.layRatePct)}
              sub={t.standardLayRatePct != null ? `padrão ${pf(t.standardLayRatePct)}${gap != null ? ` (${gap > 0 ? '+' : ''}${nf(gap, 1)} p.p.)` : ''}` : 'sem padrão cadastrado'}
              tone={gap == null ? 'default' : gap < -5 ? 'bad' : gap < 0 ? 'warn' : 'good'}
            />
            <Kpi label="Perdas de ovos" value={pf(t.lossPct)} sub={`${nf(t.lossEggs)} trinc./sujos/deform./descarte`} tone={t.lossPct != null && t.lossPct > 3 ? 'warn' : 'default'} />
            <Kpi label="Mortalidade" value={nf(t.mortality)} sub={`${pf(t.mortalityPct, 2)} do alojado`} tone={t.mortality ? 'warn' : 'default'} />
            <Kpi label="Ração" value={`${nf(t.feedKg, 1)} kg`} sub={t.feedGPerBirdDay != null ? `${nf(t.feedGPerBirdDay, 1)} g/ave/dia` : undefined} />
            <Kpi label="Custo ração" value={formatBrl(t.feedCost)} sub={t.costPerDozen != null ? `${formatBrl(t.costPerDozen)} / dúzia` : 'vincule produto na ração'} />
            <Kpi label="Perdas operacionais" value={formatBrl(t.operationalLossCost)} sub="custo estimado no período" />
            <Kpi label="Ocorrências abertas" value={nf(t.openOccurrences)} sub={`${t.criticalOccurrences} alta/crítica`} tone={t.criticalOccurrences ? 'bad' : t.openOccurrences ? 'warn' : 'good'} />
            <Kpi label="Registros a conferir" value={nf(t.awaitingReview)} tone={t.awaitingReview ? 'warn' : 'good'} />
          </div>

          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card title="Postura × padrão da linhagem (%)" className="h-80">
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis domain={[0, 100]} fontSize={11} />
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="layRatePct" name="Postura" stroke="#0f766e" dot={false} connectNulls />
                  <Line type="monotone" dataKey="standardLayRatePct" name="Padrão" stroke="#94a3b8" strokeDasharray="4 4" dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Ovos por dia (comerciais × perdas)" className="h-80">
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="commercial" name="Comerciais" stackId="a" fill="#0f766e" />
                  <Bar dataKey="lossEggs" name="Perdas" stackId="a" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Ração (kg/dia)" className="h-72">
              <ResponsiveContainer width="100%" height="88%">
                <LineChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="feedKg" name="Ração (kg)" stroke="#7c3aed" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
            <Card title="Mortalidade (aves/dia)" className="h-72">
              <ResponsiveContainer width="100%" height="88%">
                <BarChart data={chart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="mortality" name="Mortalidade" fill="#dc2626" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card title="Por galpão" className="mb-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">Galpão</th>
                    <th className="px-2 py-1.5 text-right">Lotes</th>
                    <th className="px-2 py-1.5 text-right">Aves</th>
                    <th className="px-2 py-1.5 text-right">Comerciais</th>
                    <th className="px-2 py-1.5 text-right">Postura</th>
                    <th className="px-2 py-1.5 text-right">Perdas</th>
                    <th className="px-2 py-1.5 text-right">Mortalidade</th>
                    <th className="px-2 py-1.5 text-right">Ração (kg)</th>
                    <th className="px-2 py-1.5 text-right">Ocorr. abertas</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.byBarn.map((b) => (
                    <tr key={b.barn.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <button type="button" className="text-left hover:underline" onClick={() => setBarnId(b.barn.id)}>
                          {b.barn.code} — {b.barn.name}
                        </button>
                      </td>
                      <td className="px-2 py-1.5 text-right">{b.lots}</td>
                      <td className="px-2 py-1.5 text-right">{nf(b.liveBirds)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(b.commercial)}</td>
                      <td className="px-2 py-1.5 text-right">{pf(b.layRatePct)}</td>
                      <td className="px-2 py-1.5 text-right">{pf(b.lossPct)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(b.mortality)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(b.feedKg, 1)}</td>
                      <td className={`px-2 py-1.5 text-right ${b.openOccurrences ? 'font-medium text-red-700' : ''}`}>{b.openOccurrences}</td>
                    </tr>
                  ))}
                  {!data!.byBarn.length ? (
                    <tr>
                      <td colSpan={9} className="px-2 py-4 text-center text-slate-500">
                        Sem lotes no filtro.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Por lote" className="mb-4">
            <div className="overflow-x-auto overflow-y-visible pb-1">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">Lote</th>
                    <th className="px-2 py-1.5">Linhagem</th>
                    <th className="px-2 py-1.5 text-right">Idade (sem)</th>
                    <th className="px-2 py-1.5 text-right">Aves</th>
                    <th className="px-2 py-1.5 text-right">Formas</th>
                    <th className="px-2 py-1.5 text-right">Caixas</th>
                    <th className="px-2 py-1.5 text-right">Cart. avulsas</th>
                    <th className="px-2 py-1.5 text-right">Ovos prod.</th>
                    <th className="px-2 py-1.5 text-right">Postura</th>
                    <th className="px-2 py-1.5 text-right">Padrão</th>
                    <th className="px-2 py-1.5 text-right">
                      <TableHeaderHint label="Δ p.p." hint={LAY_GAP_PP_HINT} align="right" />
                    </th>
                    <th className="px-2 py-1.5 text-right">Perdas</th>
                    <th className="px-2 py-1.5 text-right">Mort. acum. período</th>
                    <th className="px-2 py-1.5 text-right">g/ave/dia</th>
                    <th className="px-2 py-1.5 text-right">Conv. 7d</th>
                    <th className="px-2 py-1.5 text-right">R$/dúzia</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.byLot.map((l) => (
                    <tr key={l.lot.id} className="border-t border-slate-100">
                      <td className="px-2 py-1.5">
                        <button type="button" className="text-left hover:underline" onClick={() => setFlockLotId(l.lot.id)}>
                          {l.lot.code}
                        </button>
                        <span className="block text-xs text-slate-500">{l.barn.name}</span>
                      </td>
                      <td className="px-2 py-1.5 text-xs">{l.lineage}</td>
                      <td className="px-2 py-1.5 text-right">{l.ageWeeks}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.liveBirds)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.formas)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.packagingBoxes)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.packagingLooseCartons)}</td>
                      <td className="px-2 py-1.5 text-right">{nf(l.produced)}</td>
                      <td className="px-2 py-1.5 text-right">{pf(l.layRatePct)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-500">{pf(l.standardLayRatePct)}</td>
                      <td className={`px-2 py-1.5 text-right ${l.layGapPct == null ? '' : l.layGapPct < -5 ? 'font-medium text-red-700' : l.layGapPct < 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {l.layGapPct == null ? '—' : `${l.layGapPct > 0 ? '+' : ''}${nf(l.layGapPct, 1)}`}
                      </td>
                      <td className="px-2 py-1.5 text-right">{pf(l.lossPct)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {nf(l.mortality)} <span className="text-xs text-slate-500">({pf(l.mortalityPct, 2)})</span>
                      </td>
                      <td className="px-2 py-1.5 text-right">{nf(l.feedGPerBirdDay, 1)}</td>
                      <td className="px-2 py-1.5 text-right">{l.feedConversion7d == null ? '—' : nf(l.feedConversion7d, 2)}</td>
                      <td className="px-2 py-1.5 text-right">{l.costPerDozen == null ? '—' : nf(l.costPerDozen, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Perdas operacionais no período">
              {data!.losses.length ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Tipo</th>
                      <th className="px-2 py-1.5 text-right">Registros</th>
                      <th className="px-2 py-1.5 text-right">Quantidade</th>
                      <th className="px-2 py-1.5 text-right">Custo est.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data!.losses.map((l) => (
                      <tr key={l.type} className="border-t border-slate-100">
                        <td className="px-2 py-1.5">{labelEnum(l.type)}</td>
                        <td className="px-2 py-1.5 text-right">{l.count}</td>
                        <td className="px-2 py-1.5 text-right">{nf(l.quantity, 1)}</td>
                        <td className="px-2 py-1.5 text-right">{formatBrl(l.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhuma perda registrada.{' '}
                  <Link href="/operacao/perdas" className="underline">
                    Registrar
                  </Link>
                </p>
              )}
            </Card>
            <Card title="Ocorrências abertas">
              {data!.occurrences.length ? (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data!.occurrences.map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center gap-2 py-1.5">
                      <span className="text-xs text-slate-500">{formatCalendarDatePtBR(o.occurredAt.slice(0, 10))}</span>
                      <RecordStatusBadge status={o.status} />
                      <span className={`text-xs ${o.priority === 'CRITICAL' || o.priority === 'HIGH' ? 'font-medium text-red-700' : 'text-slate-500'}`}>
                        {labelEnum(o.priority)}
                      </span>
                      <span className="font-medium">{labelEnum(o.type)}</span>
                      <span className="text-slate-700">{o.description}</span>
                      <span className="text-xs text-slate-500">{[o.barn, o.lot].filter(Boolean).join(' · ')}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Nenhuma ocorrência aberta.</p>
              )}
              <Link href="/operacao/ocorrencias" className="mt-2 inline-block text-xs underline">
                Ver todas as ocorrências
              </Link>
            </Card>
          </div>
        </>
      ) : (
        !error && <p className="text-sm text-slate-500">Carregando…</p>
      )}
    </AdminShell>
  );
}
