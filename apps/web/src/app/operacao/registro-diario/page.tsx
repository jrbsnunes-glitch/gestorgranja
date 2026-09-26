'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ReviewButton, ReviewDayButton } from '@/components/operation/review-button';
import { ErrorBox, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { labelEnum } from '@/lib/labels';
import { todayIso, useBarnOptions } from '@/lib/operation-options';

type SummaryRow = {
  lot: { id: string; code: string; housedQty: number };
  barn: { id: string; code: string; name: string };
  egg: {
    id: string;
    produced: number;
    commercial: number;
    cracked: number;
    dirty: number;
    deformed: number;
    discard: number;
    status: string;
    createdByName: string | null;
  } | null;
  mortality: { total: number; entries: number; status: string | null; records: { id: string; status: string; quantity: number }[] };
  feed: { id: string; consumedKg: number; leftoverKg: number; status: string; createdByName: string | null } | null;
  occurrences: { id: string; type: string; priority: string; status: string; description: string }[];
  pending: string[];
  awaitingReview: string[];
};

type Summary = {
  date: string;
  rows: SummaryRow[];
  totals: {
    produced: number;
    commercial: number;
    losses: number;
    discard: number;
    mortality: number;
    feedKg: number;
    pendingLots: number;
    awaitingReview: number;
    openOccurrences: number;
  };
  occurrences: { id: string; type: string; priority: string; status: string; description: string; occurredAt: string }[];
};

const PENDING_LABEL: Record<string, string> = { postura: 'Postura', racao: 'Ração', mortalidade: 'Mortalidade' };

function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function Card({ label, value, tone = 'default' }: { label: string; value: string | number; tone?: 'default' | 'warn' | 'bad' | 'good' }) {
  const cls =
    tone === 'warn'
      ? 'border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'bad'
        ? 'border-red-200 bg-red-50 text-red-800'
        : tone === 'good'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
          : 'border-slate-200 bg-white text-slate-900';
  return (
    <div className={`rounded-lg border px-3 py-2 ${cls}`}>
      <p className="text-[11px] uppercase tracking-wide opacity-70">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export default function RegistroDiarioPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Carregando…</p>}>
      <RegistroDiarioContent />
    </Suspense>
  );
}

function RegistroDiarioContent() {
  const searchParams = useSearchParams();
  const initial = searchParams.get('date');
  const [date, setDate] = useState(initial && /^\d{4}-\d{2}-\d{2}$/.test(initial) ? initial : todayIso());
  const [barnId, setBarnId] = useState('');
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const barns = useBarnOptions();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void apiFetch<Summary>(`/v1/operation/daily-summary?date=${date}${barnId ? `&barnId=${barnId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [date, barnId]);

  useEffect(() => {
    load();
  }, [load]);

  const t = data?.totals;

  return (
    <AdminShell title="Registro diário">
      <PageIntro
        title="Registro diário"
        description="Visão consolidada do dia por lote: o que já foi lançado (postura, mortalidade, ração, ocorrências), o que falta e o que aguarda conferência."
      />
      <ErrorBox message={error} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1">
          <button type="button" className="rounded border px-2 py-1.5 text-sm hover:bg-slate-50" onClick={() => setDate(shiftDate(date, -1))}>
            ‹
          </button>
          <input type="date" className={`${inputClass} w-44`} value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            type="button"
            className="rounded border px-2 py-1.5 text-sm hover:bg-slate-50"
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= todayIso()}
          >
            ›
          </button>
          <button type="button" className="ml-1 rounded border px-2 py-1.5 text-xs hover:bg-slate-50" onClick={() => setDate(todayIso())}>
            Hoje
          </button>
        </div>
        <select className={`${inputClass} w-56`} value={barnId} onChange={(e) => setBarnId(e.target.value)}>
          <option value="">Todos os galpões</option>
          {barns.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} — {b.name}
            </option>
          ))}
        </select>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
          <ReviewDayButton date={date} barnId={barnId || undefined} count={t?.awaitingReview} onDone={load} />
          <Link href="/producao" className="rounded border px-2 py-1.5 hover:bg-slate-50">
            Lançar postura / mortalidade / ração
          </Link>
          <Link href="/operacao/ocorrencias" className="rounded border px-2 py-1.5 hover:bg-slate-50">
            Ocorrências
          </Link>
          <Link href="/operacao/insumos" className="rounded border px-2 py-1.5 hover:bg-slate-50">
            Insumos
          </Link>
          <Link href="/operacao/perdas" className="rounded border px-2 py-1.5 hover:bg-slate-50">
            Perdas
          </Link>
        </div>
      </div>

      {t ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Card label="Ovos produzidos" value={t.produced.toLocaleString('pt-BR')} />
          <Card label="Comerciais" value={t.commercial.toLocaleString('pt-BR')} tone="good" />
          <Card label="Trincados/sujos/deform." value={t.losses.toLocaleString('pt-BR')} tone={t.losses ? 'warn' : 'default'} />
          <Card label="Descarte" value={t.discard.toLocaleString('pt-BR')} tone={t.discard ? 'warn' : 'default'} />
          <Card label="Mortalidade" value={t.mortality.toLocaleString('pt-BR')} tone={t.mortality ? 'warn' : 'default'} />
          <Card label="Ração (kg)" value={t.feedKg.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} />
          <Card label="Lotes com pendência" value={t.pendingLots} tone={t.pendingLots ? 'bad' : 'good'} />
          <Card label="Registros a conferir" value={t.awaitingReview} tone={t.awaitingReview ? 'warn' : 'good'} />
          <Card label="Ocorrências abertas" value={t.openOccurrences} tone={t.openOccurrences ? 'bad' : 'good'} />
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <tr>
              <th className="px-3 py-2">Galpão / Lote</th>
              <th className="px-3 py-2">Postura</th>
              <th className="px-3 py-2">Mortalidade</th>
              <th className="px-3 py-2">Ração</th>
              <th className="px-3 py-2">Ocorrências</th>
              <th className="px-3 py-2">Pendências</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Carregando…
                </td>
              </tr>
            ) : null}
            {data && !data.rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                  Nenhum lote ativo para {formatCalendarDatePtBR(data.date)}.
                </td>
              </tr>
            ) : null}
            {data?.rows.map((r) => (
              <tr key={r.lot.id} className="border-t border-slate-100 align-top">
                <td className="px-3 py-2">
                  <p className="font-medium">{r.barn.name}</p>
                  <p className="text-xs text-slate-500">
                    Lote {r.lot.code} · {r.lot.housedQty.toLocaleString('pt-BR')} aves alojadas
                  </p>
                </td>
                <td className="px-3 py-2">
                  {r.egg ? (
                    <div className="space-y-0.5">
                      <p>
                        <span className="font-medium">{r.egg.produced.toLocaleString('pt-BR')}</span> ovos ·{' '}
                        {r.egg.commercial.toLocaleString('pt-BR')} comerciais
                      </p>
                      <p className="text-xs text-slate-500">
                        {r.egg.cracked} trinc. · {r.egg.dirty} sujos · {r.egg.deformed} deform. · {r.egg.discard} desc.
                      </p>
                      <p className="flex items-center gap-2 text-xs">
                        <RecordStatusBadge status={r.egg.status} />
                        <span className="text-slate-500">{r.egg.createdByName ?? ''}</span>
                        <ReviewButton entity="DailyEggProduction" id={r.egg.id} status={r.egg.status} onDone={load} />
                      </p>
                    </div>
                  ) : (
                    <Link href="/producao" className="text-xs text-red-700 underline">
                      Não lançada — lançar
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.mortality.entries ? (
                    <div className="space-y-0.5">
                      <p>
                        <span className="font-medium">{r.mortality.total}</span> ave(s) em {r.mortality.entries} registro(s)
                      </p>
                      <p className="flex flex-wrap items-center gap-2 text-xs">
                        <RecordStatusBadge status={r.mortality.status} />
                        {r.mortality.records
                          .filter((m) => m.status !== 'REVIEWED')
                          .map((m) => (
                            <ReviewButton key={m.id} entity="DailyMortality" id={m.id} status={m.status} onDone={load} />
                          ))}
                      </p>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500">Sem registro (zero)</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.feed ? (
                    <div className="space-y-0.5">
                      <p>
                        <span className="font-medium">{r.feed.consumedKg.toLocaleString('pt-BR')}</span> kg
                        {r.feed.leftoverKg ? ` · sobra ${r.feed.leftoverKg.toLocaleString('pt-BR')} kg` : ''}
                      </p>
                      <p className="flex items-center gap-2 text-xs">
                        <RecordStatusBadge status={r.feed.status} />
                        <span className="text-slate-500">{r.feed.createdByName ?? ''}</span>
                        <ReviewButton entity="DailyFeedConsumption" id={r.feed.id} status={r.feed.status} onDone={load} />
                      </p>
                    </div>
                  ) : (
                    <Link href="/producao?tab=racao" className="text-xs text-red-700 underline">
                      Não lançada — lançar
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2">
                  {r.occurrences.length ? (
                    <ul className="space-y-1 text-xs">
                      {r.occurrences.map((o) => (
                        <li key={o.id} className="flex items-start gap-1.5">
                          <RecordStatusBadge status={o.status} />
                          <span>
                            <span className="font-medium">{labelEnum(o.type)}</span> ({labelEnum(o.priority)}) — {o.description}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.pending.length ? (
                    <p className="text-red-700">Falta: {r.pending.map((p) => PENDING_LABEL[p] ?? p).join(', ')}</p>
                  ) : null}
                  {r.awaitingReview.length ? (
                    <p className="text-amber-700">A conferir: {r.awaitingReview.map((p) => PENDING_LABEL[p] ?? p).join(', ')}</p>
                  ) : null}
                  {!r.pending.length && !r.awaitingReview.length ? <span className="text-emerald-700">Dia completo</span> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.occurrences.length ? (
        <section className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-800">Ocorrências do dia (todas)</h3>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white text-sm">
            {data.occurrences.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                <span className="text-xs text-slate-500">{new Date(o.occurredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                <RecordStatusBadge status={o.status} />
                <span className="font-medium">{labelEnum(o.type)}</span>
                <span className="text-xs text-slate-500">{labelEnum(o.priority)}</span>
                <span className="text-slate-700">{o.description}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </AdminShell>
  );
}
