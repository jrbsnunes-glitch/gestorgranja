'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { readSession, sessionHasPermission } from '@/lib/session';

export function canReview() {
  return sessionHasPermission(readSession(), 'production.review');
}

/** Botão "Conferir" para um registro operacional (status → REVIEWED). */
export function ReviewButton({
  entity,
  id,
  status,
  onDone,
  className = '',
}: {
  entity: string;
  id: string;
  status: string | null | undefined;
  onDone?: () => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!canReview()) return null;
  if (!status || status === 'REVIEWED') return null;

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/v1/operation/review/${entity}/${id}`, { method: 'PATCH', body: JSON.stringify({}) });
      onDone?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
        title="Marcar como conferido"
      >
        {busy ? '…' : 'Conferir'}
      </button>
      {err ? <span className="text-xs text-red-600">{err}</span> : null}
    </span>
  );
}

/** Confere todos os registros pendentes de uma data (opcionalmente de um galpão). */
export function ReviewDayButton({ date, barnId, onDone, count }: { date: string; barnId?: string; onDone?: () => void; count?: number }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!canReview()) return null;

  async function run() {
    if (!window.confirm(`Conferir todos os registros pendentes de ${date.split('-').reverse().join('/')}?`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ total: number; reviewed: number }>('/v1/operation/review/day', {
        method: 'POST',
        body: JSON.stringify({ date, barnId: barnId || undefined }),
      });
      setMsg(`${r.reviewed} de ${r.total} registro(s) conferido(s).`);
      onDone?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy || count === 0}
        onClick={run}
        className="rounded border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"
      >
        {busy ? 'Conferindo…' : `Conferir tudo do dia${count != null ? ` (${count})` : ''}`}
      </button>
      {msg ? <span className="text-xs text-slate-600">{msg}</span> : null}
    </span>
  );
}
