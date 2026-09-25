'use client';

import { Button, Card } from '@gestor-granja/ui';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { campoDb } from '@/lib/db';
import { getApiBase } from '@/lib/api-base';
import { enqueue, flushSyncQueue } from '@/lib/sync';

type Lot = { id: string; code: string };

export default function CampoPage() {
  const [token, setToken] = useState('');
  const [tenantSlug, setTenantSlug] = useState('demo');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [lots, setLots] = useState<Lot[]>([]);
  const [lotId, setLotId] = useState('');
  const [pending, setPending] = useState(0);
  const [online, setOnline] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  const refreshPending = useCallback(async () => {
    const n = await campoDb.syncQueue.where('status').equals('pending').count();
    setPending(n);
  }, []);

  const trySync = useCallback(async () => {
    const t = token || localStorage.getItem('gg_campo_token') || '';
    if (!t || !navigator.onLine) return;
    try {
      const r = await flushSyncQueue(t);
      setMsg(`Sincronizado: ${r.flushed} operação(ões)`);
      await refreshPending();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro na sync');
    }
  }, [token, refreshPending]);

  useEffect(() => {
    setOnline(navigator.onLine);
    const on = () => {
      setOnline(true);
      void trySync();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    window.addEventListener('gg-sync', trySync);
    void refreshPending();
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
      window.removeEventListener('gg-sync', trySync);
    };
  }, [trySync, refreshPending]);

  async function login() {
    setLoginError(null);
    setLoggingIn(true);
    try {
      const api = getApiBase();
      const res = await fetch(`${api}/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantSlug: tenantSlug.trim(),
          username: username.trim(),
          password,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Login falhou (${res.status})`);
      }
      const data = (await res.json()) as { accessToken: string };
      localStorage.setItem('gg_campo_token', data.accessToken);
      setToken(data.accessToken);
      const lotRes = await fetch(`${api}/v1/production/lots`, {
        headers: { Authorization: `Bearer ${data.accessToken}` },
      });
      if (!lotRes.ok) {
        const text = await lotRes.text();
        throw new Error(
          text ||
            'Login OK, mas não foi possível listar lotes (permissão production.read ou perfil sem acesso).',
        );
      }
      const lotRows = (await lotRes.json()) as Lot[];
      setLots(lotRows);
      if (lotRows[0]) setLotId(lotRows[0].id);
      if (!lotRows.length) {
        setMsg('Nenhum lote visível para este usuário. Cadastre um lote no painel ou ajuste permissões.');
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : 'Falha ao entrar';
      if (err.includes('Failed to fetch') || err.includes('NetworkError')) {
        setLoginError('Sem conexão com a API. Verifique internet ou se o site está no ar.');
      } else {
        setLoginError(err.slice(0, 280));
      }
    } finally {
      setLoggingIn(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const date = String(fd.get('date'));
    const operationId = crypto.randomUUID();
    const payload = {
      flockLotId: lotId,
      date,
      extra: Number(fd.get('extra') || 0),
      large: Number(fd.get('large') || 0),
      medium: Number(fd.get('medium') || 0),
      small: Number(fd.get('small') || 0),
      cracked: Number(fd.get('cracked') || 0),
      dirty: Number(fd.get('dirty') || 0),
      deformed: Number(fd.get('deformed') || 0),
      discard: Number(fd.get('discard') || 0),
    };

    await enqueue({
      operationId,
      type: 'dailyEggProduction',
      payload,
      clientUpdatedAt: new Date().toISOString(),
    });
    await refreshPending();
    setMsg(online ? 'Enfileirado — sincronizando…' : 'Salvo offline na fila');
    if (online) void trySync();
  }

  return (
    <main className="mx-auto max-w-lg p-4 pb-16">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-emerald-900">Campo — Postura</h1>
        <span className={`text-xs ${online ? 'text-emerald-700' : 'text-amber-700'}`}>
          {online ? 'Online' : 'Offline'}
        </span>
      </header>

      {!token ? (
        <Card title="Conectar">
          <input
            className="mb-2 w-full rounded border p-3"
            value={tenantSlug}
            onChange={(e) => setTenantSlug(e.target.value)}
            placeholder="Granja (slug)"
            autoComplete="organization"
          />
          <input
            className="mb-2 w-full rounded border p-3"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Usuário"
            autoComplete="username"
          />
          <input
            className="mb-2 w-full rounded border p-3"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            autoComplete="current-password"
          />
          {loginError ? <p className="text-sm text-red-600">{loginError}</p> : null}
          <Button className="w-full" disabled={loggingIn} onClick={() => void login()}>
            {loggingIn ? 'Entrando…' : 'Entrar'}
          </Button>
        </Card>
      ) : (
        <>
          <select
            className="mb-3 w-full rounded border p-3 text-lg"
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
          >
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code}
              </option>
            ))}
          </select>

          <Card title="Produção do dia">
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
              <input name="date" type="date" className="rounded border p-3" required defaultValue={new Date().toISOString().slice(0, 10)} />
              {(['extra', 'large', 'medium', 'small', 'cracked', 'dirty', 'deformed', 'discard'] as const).map((f) => (
                <label key={f} className="flex items-center justify-between gap-2 text-sm">
                  <span className="capitalize">{f}</span>
                  <input name={f} type="number" min={0} defaultValue={0} className="w-28 rounded border p-2 text-right" />
                </label>
              ))}
              <Button type="submit" className="w-full py-3 text-base">
                Salvar {online ? '' : '(offline)'}
              </Button>
            </form>
          </Card>

          <p className="mt-3 text-center text-sm text-slate-600">
            Fila pendente: {pending}{' '}
            <button type="button" className="text-emerald-700 underline" onClick={() => void trySync()}>
              Sync agora
            </button>
          </p>
        </>
      )}

      {msg ? <p className="mt-3 text-center text-sm">{msg}</p> : null}
    </main>
  );
}
