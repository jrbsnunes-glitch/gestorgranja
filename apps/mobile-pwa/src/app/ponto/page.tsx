'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PunchQrScanner } from '@/components/punch-qr-scanner';
import { getApiBase } from '@/lib/api-base';
import { CAMPO_BASE_PATH } from '@/lib/campo-base-path';

export default function PontoPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitPunch(terminalId: string, token: string) {
    setSubmitting(true);
    setError(null);
    setMsg(null);
    try {
      const jwt = localStorage.getItem('gg_campo_token') ?? '';
      if (!jwt) throw new Error(`Faça login em ${CAMPO_BASE_PATH} antes de bater ponto.`);
      const res = await fetch(`${getApiBase()}/v1/hr/time/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ terminalId, token, source: 'MOBILE' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as { type: string; punchedAt: string };
      setMsg(r.type === 'IN' ? 'Entrada registrada' : 'Saída registrada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-4 pb-12">
      <Link href={CAMPO_BASE_PATH} className="text-sm text-emerald-800 underline">
        ← Voltar
      </Link>
      <h1 className="mb-2 mt-3 text-lg font-semibold">Batida de ponto</h1>
      <p className="mb-4 text-sm text-slate-600">
        Use a câmera para ler o QR da portaria. É necessário estar logado e vinculado a um funcionário no RH.
      </p>
      {msg ? <p className="mb-3 text-emerald-700">{msg}</p> : null}
      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}
      {submitting ? <p className="mb-3 text-sm text-slate-600">Registrando batida…</p> : null}
      <PunchQrScanner
        onScan={(data) => void submitPunch(data.terminalId, data.token)}
        onError={(m) => setError(m)}
      />
    </main>
  );
}
