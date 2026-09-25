'use client';

import { Button, Card } from '@gestor-granja/ui';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { campoDb } from '@/lib/db';
import { getApiBase } from '@/lib/api-base';
import { EGG_PRODUCTION_FIELDS } from '@/lib/labels';
import { enqueue, flushSyncQueue } from '@/lib/sync';

type Lot = {
  id: string;
  code: string;
  barn?: { code: string; name: string };
};

async function fetchLots(api: string, accessToken: string): Promise<Lot[]> {
  const lotRes = await fetch(`${api}/v1/production/lots`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!lotRes.ok) {
    const text = await lotRes.text();
    throw new Error(
      text || 'Não foi possível listar lotes (permissão production.read ou perfil sem acesso).',
    );
  }
  return (await lotRes.json()) as Lot[];
}

function lotLabel(l: Lot): string {
  const barn = l.barn?.code || l.barn?.name;
  return barn ? `${barn} — ${l.code}` : l.code;
}

export default function CampoPage() {
  const [token, setToken] = useState('');
  const [scopedBarnIds, setScopedBarnIds] = useState<string[]>([]);
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
      setMsg(e instanceof Error ? e.message : 'Erro na sincronização');
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

  useEffect(() => {
    const stored = localStorage.getItem('gg_campo_token');
    if (!stored) return;
    setToken(stored);
    const api = getApiBase();
    void fetchLots(api, stored)
      .then((lotRows) => {
        setLots(lotRows);
        if (lotRows[0]) setLotId(lotRows[0].id);
        if (!lotRows.length) {
          setMsg(
            'Nenhum lote visível para este usuário. Confira escopo por galpão em Usuários ou cadastre um lote.',
          );
        }
      })
      .catch((e) => {
        localStorage.removeItem('gg_campo_token');
        setToken('');
        setLoginError(e instanceof Error ? e.message : 'Sessão expirada — entre de novo.');
      });
  }, []);

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
      const data = (await res.json()) as {
        accessToken: string;
        user?: { barnIds?: string[] };
      };
      localStorage.setItem('gg_campo_token', data.accessToken);
      setToken(data.accessToken);
      const barnIds = data.user?.barnIds ?? [];
      setScopedBarnIds(barnIds);
      const lotRows = await fetchLots(api, data.accessToken);
      setLots(lotRows);
      if (lotRows[0]) setLotId(lotRows[0].id);
      if (!lotRows.length) {
        setMsg(
          barnIds.length
            ? 'Nenhum lote nos galpões permitidos para este usuário. Em Usuários → Atribuições de perfil, inclua o galpão ou deixe galpão em branco.'
            : 'Nenhum lote nesta granja. Cadastre em Cadastros → Lotes (mesmo slug usado no login).',
        );
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
        <h1 className="text-lg font-bold text-emerald-900">Campo — Postura diária</h1>
        <span className={`text-xs ${online ? 'text-emerald-700' : 'text-amber-700'}`}>
          {online ? 'Conectado' : 'Sem internet'}
        </span>
      </header>

      {!token ? (
        <Card title="Entrar na granja">
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
          <label className="mb-1 block text-sm font-medium text-slate-700">Galpão — lote</label>
          <select
            className="mb-3 w-full rounded border p-3 text-lg"
            value={lotId}
            onChange={(e) => setLotId(e.target.value)}
          >
            {lots.length === 0 ? (
              <option value="">Nenhum lote disponível</option>
            ) : (
              lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {lotLabel(l)}
                </option>
              ))
            )}
          </select>
          {lots.length === 0 && scopedBarnIds.length > 0 ? (
            <p className="mb-3 text-sm text-amber-800">
              Este login está limitado a galpão(ões) específico(s). O lote do banco precisa estar vinculado a um
              galpão liberado no perfil.
            </p>
          ) : null}

          <Card title="Produção do dia">
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
              <label className="text-sm font-medium text-slate-700">
                Data
                <input
                  name="date"
                  type="date"
                  className="mt-1 w-full rounded border p-3"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </label>
              {EGG_PRODUCTION_FIELDS.map((f) => (
                <label key={f.name} className="flex items-center justify-between gap-2 text-sm">
                  <span>{f.label}</span>
                  <input
                    name={f.name}
                    type="number"
                    min={0}
                    defaultValue={0}
                    className="w-28 rounded border p-2 text-right"
                    inputMode="numeric"
                  />
                </label>
              ))}
              <Button type="submit" className="w-full py-3 text-base">
                Salvar {online ? '' : '(sem internet)'}
              </Button>
            </form>
          </Card>

          <p className="mt-3 text-center text-sm text-slate-600">
            Fila pendente: {pending}{' '}
            <button type="button" className="text-emerald-700 underline" onClick={() => void trySync()}>
              Sincronizar agora
            </button>
          </p>
        </>
      )}

      {msg ? <p className="mt-3 text-center text-sm">{msg}</p> : null}
    </main>
  );
}
