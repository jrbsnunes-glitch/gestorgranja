'use client';

import { FormEvent, useState } from 'react';
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3010/api';

export default function PontoPage() {
  const [terminalId, setTerminalId] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    try {
      const jwt = localStorage.getItem('gg_campo_token') ?? '';
      if (!jwt) throw new Error('Faça login na tela inicial do PWA');
      const res = await fetch(`${API}/v1/hr/time/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ terminalId, token: qrToken, source: 'MOBILE' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as { type: string; punchedAt: string };
      setMsg(r.type === 'IN' ? 'Entrada registrada' : 'Saída registrada');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-lg font-semibold">Ponto — scan QR</h1>
      <p className="mb-4 text-sm text-slate-600">
        Escaneie o QR da portaria ou cole o código exibido no terminal. É necessário estar logado e vinculado a um
        funcionário.
      </p>
      {msg ? <p className="mb-3 text-emerald-700">{msg}</p> : null}
      {error ? <p className="mb-3 text-red-600">{error}</p> : null}
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <label className="block text-sm">
          ID do terminal
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={terminalId}
            onChange={(e) => setTerminalId(e.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Código QR (token)
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={qrToken}
            onChange={(e) => setQrToken(e.target.value)}
            required
          />
        </label>
        <button type="submit" className="w-full rounded bg-emerald-700 py-2 text-white">
          Registrar ponto
        </button>
      </form>
    </main>
  );
}
