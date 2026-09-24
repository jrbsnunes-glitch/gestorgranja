'use client';

import { Card } from '@gestor-granja/ui';
import { useCallback, useEffect, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AdminShell } from '@/components/admin-shell';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR, formatPercentPtBR } from '@/lib/calendar-date';
import { DASHBOARD_REFRESH_EVENT } from '@/lib/dashboard-refresh';

const DASHBOARD_POLL_MS = 30_000;

type LayChartPoint = {
  date: string;
  real: number;
  padrao: number;
  commercialEggs: number;
};

function LayRateTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload: LayChartPoint }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded border border-slate-200 bg-white p-3 text-sm shadow-md">
      <p className="font-medium text-slate-800">{label}</p>
      <p className="mt-1 text-xs text-slate-500">Postura do dia (lote selecionado)</p>
      <p className="mt-1 text-emerald-800">
        Real: <span className="font-semibold">{formatPercentPtBR(row.real)}</span>
      </p>
      <p className="text-slate-600">
        Padrão: <span className="font-semibold">{formatPercentPtBR(row.padrao)}</span>
      </p>
      <p className="mt-2 border-t border-slate-100 pt-2 text-slate-600">
        Ovos comerciais:{' '}
        <span className="font-semibold">{row.commercialEggs.toLocaleString('pt-BR')}</span> un.
      </p>
    </div>
  );
}

type Lot = { id: string; code: string; barn: { name: string } };

type Dashboard = {
  ageDays: number;
  liveBirds: number;
  standardLayRatePct: number | null;
  currentLayRatePct: number | null;
  mortalityAccumulated: number;
  feedConversion: number | null;
  layRateSeries: { date: string; layRatePct: number; commercialEggs: number }[];
};

type EggInventory = {
  boxes: number;
  cartons: number;
  totalEggs: number;
  eggsPerCarton: number;
  cartonsPerBox: number;
  eggsPerBox: number;
};

export default function DashboardPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotId, setLotId] = useState<string>('');
  const [data, setData] = useState<Dashboard | null>(null);
  const [cost, setCost] = useState<{ costPerDozen: number | null; commercialEggs: number } | null>(
    null,
  );
  const [eggInventory, setEggInventory] = useState<EggInventory | null>(null);
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  useEffect(() => {
    void apiFetch<Lot[]>('/v1/production/lots').then((rows) => {
      setLots(rows);
      if (rows[0]) setLotId(rows[0].id);
    });
  }, []);

  const refreshDashboard = useCallback(() => {
    if (!lotId) return;
    void Promise.all([
      apiFetch<Dashboard>(`/v1/reports/dashboard/${lotId}`).then(setData),
      apiFetch<{ costPerDozen: number | null; commercialEggs: number }>(
        `/v1/reports/cost-per-dozen/${lotId}`,
      ).then(setCost),
      apiFetch<EggInventory>('/v1/reports/egg-inventory').then(setEggInventory),
    ]).then(() => setRefreshedAt(new Date()));
  }, [lotId]);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  useEffect(() => {
    const id = window.setInterval(refreshDashboard, DASHBOARD_POLL_MS);
    return () => window.clearInterval(id);
  }, [refreshDashboard]);

  useEffect(() => {
    const onRefresh = () => refreshDashboard();
    window.addEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(DASHBOARD_REFRESH_EVENT, onRefresh);
  }, [refreshDashboard]);

  const chartData: LayChartPoint[] =
    data?.layRateSeries.map((p) => ({
      date: formatCalendarDatePtBR(p.date),
      real: p.layRatePct,
      padrao: data.standardLayRatePct ?? 0,
      commercialEggs: p.commercialEggs,
    })) ?? [];

  return (
    <AdminShell title="Painel zootécnico">
      <select
        className="mb-4 rounded border border-slate-300 p-2 text-sm"
        value={lotId}
        onChange={(e) => setLotId(e.target.value)}
      >
        {lots.map((l) => (
          <option key={l.id} value={l.id}>
            {l.code} — {l.barn.name}
          </option>
        ))}
      </select>

      {refreshedAt ? (
        <p className="-mt-2 mb-4 text-xs text-slate-500">
          Atualizado às {refreshedAt.toLocaleTimeString('pt-BR')} (atualiza a cada 30 s ou ao clicar
          em Painel)
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        <Card title="% Postura (atual)">
          <p className="text-2xl font-semibold">
            {data?.currentLayRatePct != null ? formatPercentPtBR(data.currentLayRatePct) : '—'}
          </p>
          <p className="text-xs text-slate-500">
            Padrão linhagem:{' '}
            {data?.standardLayRatePct != null ? formatPercentPtBR(data.standardLayRatePct) : '—'}
          </p>
        </Card>
        <Card title="Aves vivas">
          <p className="text-2xl font-semibold">{data?.liveBirds ?? '—'}</p>
          <p className="text-xs text-slate-500">Idade: {data?.ageDays ?? '—'} dias</p>
        </Card>
        <Card title="Mortalidade acum.">
          <p className="text-2xl font-semibold">{data?.mortalityAccumulated ?? '—'}</p>
        </Card>
        <Card title="Conversão alimentar">
          <p className="text-2xl font-semibold">{data?.feedConversion ?? '—'}</p>
        </Card>
        <Card title="Custo por dúzia (estim.)">
          <p className="text-2xl font-semibold">
            {cost?.costPerDozen != null ? `R$ ${cost.costPerDozen.toFixed(2)}` : '—'}
          </p>
          <p className="text-xs text-slate-500">Ovos comerciais: {cost?.commercialEggs ?? '—'}</p>
        </Card>
      </div>

      <Card title="Postura real vs padrão (%)" className="mt-6 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 100]} />
            <Tooltip content={<LayRateTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="real" stroke="#047857" name="Real" />
            <Line type="monotone" dataKey="padrao" stroke="#94a3b8" name="Padrão" strokeDasharray="4 4" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <p className="mt-4 text-sm text-slate-600">
        Estoque de ovos (saldo das movimentações — não confundir com a postura de um único dia no
        gráfico):
      </p>
      <div className="mt-2 grid gap-4 md:grid-cols-3">
        <Card title="Quantidade de caixa de ovos">
          <p className="text-2xl font-semibold">
            {eggInventory != null ? eggInventory.boxes.toLocaleString('pt-BR') : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {eggInventory
              ? `${eggInventory.cartonsPerBox} cartelas/caixa · ${eggInventory.eggsPerBox} ovos/caixa`
              : '—'}
          </p>
        </Card>
        <Card title="Quantidade de cartela de ovo">
          <p className="text-2xl font-semibold">
            {eggInventory != null ? eggInventory.cartons.toLocaleString('pt-BR') : '—'}
          </p>
          <p className="text-xs text-slate-500">
            {eggInventory ? `${eggInventory.eggsPerCarton} ovos/cartela (avulsas)` : '—'}
          </p>
        </Card>
        <Card title="Quantidade de ovos totais">
          <p className="text-2xl font-semibold">
            {eggInventory != null ? eggInventory.totalEggs.toLocaleString('pt-BR') : '—'}
          </p>
          <p className="text-xs text-slate-500">Caixas × ovos/caixa + cartelas × ovos/cartela</p>
        </Card>
      </div>
    </AdminShell>
  );
}
