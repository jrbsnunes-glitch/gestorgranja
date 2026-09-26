'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ReviewButton, ReviewDayButton, canReview } from '@/components/operation/review-button';
import { ErrorBox, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { todayIso, useBarnOptions } from '@/lib/operation-options';

type PendingItem = {
  date: string;
  lot: { id: string; code: string };
  barn: { id: string; code: string; name: string };
  missing: string[];
  awaitingReview: { entity: string; id: string; kind: string; status: string }[];
};

type Pending = {
  from: string;
  to: string;
  totals: { days: number; items: number; missing: number; awaitingReview: number; openOccurrences: number };
  items: PendingItem[];
};

const KIND_LABEL: Record<string, string> = { postura: 'Postura', racao: 'Ração', mortalidade: 'Mortalidade' };

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function PendenciasPage() {
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(todayIso());
  const [barnId, setBarnId] = useState('');
  const [data, setData] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [onlyMissing, setOnlyMissing] = useState(false);
  const barns = useBarnOptions();

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    void apiFetch<Pending>(`/v1/operation/pending?from=${from}&to=${to}${barnId ? `&barnId=${barnId}` : ''}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'))
      .finally(() => setLoading(false));
  }, [from, to, barnId]);

  useEffect(() => {
    load();
  }, [load]);

  const items = (data?.items ?? []).filter((i) => (onlyMissing ? i.missing.length > 0 : true));
  const byDate = new Map<string, PendingItem[]>();
  for (const it of items) {
    const arr = byDate.get(it.date) ?? [];
    arr.push(it);
    byDate.set(it.date, arr);
  }
  const dates = [...byDate.keys()].sort((a, b) => (a < b ? 1 : -1));

  return (
    <AdminShell title="Pendências operacionais">
      <PageIntro
        title="Pendências operacionais"
        description="Lançamentos faltantes por lote e dia (postura, ração) e registros aguardando conferência no período."
      />
      <ErrorBox message={error} />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-slate-600">
          De
          <input type="date" className={`${inputClass} mt-1 w-40`} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-xs text-slate-600">
          Até
          <input type="date" className={`${inputClass} mt-1 w-40`} value={to} max={todayIso()} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label className="text-xs text-slate-600">
          Galpão
          <select className={`${inputClass} mt-1 w-56`} value={barnId} onChange={(e) => setBarnId(e.target.value)}>
            <option value="">Todos</option>
            {barns.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 pb-2 text-xs text-slate-600">
          <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
          Só lançamentos faltantes
        </label>
      </div>

      {data ? (
        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">Dias analisados</p>
            <p className="text-lg font-semibold">{data.totals.days}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${data.totals.missing ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <p className="text-[11px] uppercase tracking-wide opacity-70">Lançamentos faltantes</p>
            <p className="text-lg font-semibold">{data.totals.missing}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${data.totals.awaitingReview ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>
            <p className="text-[11px] uppercase tracking-wide opacity-70">Aguardando conferência</p>
            <p className="text-lg font-semibold">{data.totals.awaitingReview}</p>
          </div>
          <div className={`rounded-lg border px-3 py-2 ${data.totals.openOccurrences ? 'border-red-200 bg-red-50 text-red-800' : 'border-slate-200 bg-white'}`}>
            <p className="text-[11px] uppercase tracking-wide opacity-70">Ocorrências abertas</p>
            <p className="text-lg font-semibold">
              <Link href="/operacao/ocorrencias" className="underline-offset-2 hover:underline">
                {data.totals.openOccurrences}
              </Link>
            </p>
          </div>
        </div>
      ) : null}

      {loading && !data ? <p className="text-sm text-slate-500">Carregando…</p> : null}
      {data && !items.length ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-4 text-sm text-emerald-900">
          Nenhuma pendência no período selecionado.
        </p>
      ) : null}

      {dates.map((d) => {
        const rows = byDate.get(d)!;
        const awaiting = rows.reduce((s, r) => s + r.awaitingReview.length, 0);
        return (
          <section key={d} className="mb-4 rounded-lg border border-slate-200 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
              <h3 className="text-sm font-semibold text-slate-800">
                {formatCalendarDatePtBR(d)}{' '}
                <span className="text-xs font-normal text-slate-500">
                  · {rows.length} lote(s) com pendência
                </span>
              </h3>
              <div className="flex items-center gap-2">
                <Link href={`/operacao/registro-diario?date=${d}`} className="text-xs text-slate-600 underline-offset-2 hover:underline">
                  Ver registro diário
                </Link>
                {awaiting > 0 ? <ReviewDayButton date={d} barnId={barnId || undefined} count={awaiting} onDone={load} /> : null}
              </div>
            </header>
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-1.5">Galpão / Lote</th>
                  <th className="px-3 py-1.5">Faltando</th>
                  <th className="px-3 py-1.5">Aguardando conferência</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.date}-${r.lot.id}`} className="border-t border-slate-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium">{r.barn.name}</p>
                      <p className="text-xs text-slate-500">Lote {r.lot.code}</p>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.missing.length ? (
                        <span className="text-red-700">
                          {r.missing.map((m) => KIND_LABEL[m] ?? m).join(', ')}{' '}
                          <Link href={r.missing.includes('postura') ? '/producao' : '/producao?tab=racao'} className="underline">
                            lançar
                          </Link>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {r.awaitingReview.length ? (
                        <ul className="space-y-1">
                          {r.awaitingReview.map((a) => (
                            <li key={`${a.entity}-${a.id}`} className="flex flex-wrap items-center gap-2">
                              <span>{KIND_LABEL[a.kind] ?? a.kind}</span>
                              <RecordStatusBadge status={a.status} />
                              <ReviewButton entity={a.entity} id={a.id} status={a.status} onDone={load} />
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {!canReview() && data?.totals.awaitingReview ? (
        <p className="text-xs text-slate-500">Você não tem permissão de conferência (production.review); os botões de conferir ficam ocultos.</p>
      ) : null}
    </AdminShell>
  );
}
