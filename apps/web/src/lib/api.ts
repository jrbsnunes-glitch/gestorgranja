import { formatApiError } from '@/lib/labels';

const DEFAULT_LOCAL_API = 'http://127.0.0.1:3010/api';

/** Base da API Nest (`/api` no servidor). Em Tailscale/LAN usa o mesmo host do Next via proxy. */
export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (typeof window === 'undefined') {
    if (configured?.startsWith('/')) return DEFAULT_LOCAL_API;
    return configured || DEFAULT_LOCAL_API;
  }

  const { hostname, origin } = window.location;
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (configured?.startsWith('/')) {
    return `${origin}${configured.replace(/\/$/, '')}`;
  }

  if (configured && configured.includes('localhost') && !isLocalHost) {
    return `${origin}/api`;
  }

  if (configured) return configured.replace(/\/$/, '');

  return `${origin}/api`;
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gg_token');
}

function apiUnavailableMessage(base: string): string {
  return `Não foi possível conectar à API (${base}). Verifique se o backend está rodando na porta 3010 (pnpm dev na pasta apps/api ou turbo dev).`;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(apiUnavailableMessage(base));
  }
  if (!res.ok) {
    const text = await res.text();
    if (
      res.status >= 500 &&
      (!text.trim() ||
        /internal server error/i.test(text) ||
        /ECONNREFUSED|failed to proxy/i.test(text))
    ) {
      throw new Error(apiUnavailableMessage(base));
    }
    throw new Error(formatApiError(text || res.statusText));
  }
  return res.json() as Promise<T>;
}

/** Upload multipart (não define Content-Type — o browser envia boundary). */
export async function apiUpload<T>(path: string, formData: FormData, init?: RequestInit): Promise<T> {
  const token = getToken();
  const base = getApiBase();
  const res = await fetch(`${base}${path.startsWith('/') ? path : `/${path}`}`, {
    ...init,
    method: 'POST',
    body: formData,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatApiError(text || res.statusText));
  }
  return res.json() as Promise<T>;
}

export async function login(tenantSlug: string, username: string, password: string) {
  const base = getApiBase();
  let res: Response;
  try {
    res = await fetch(`${base}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, username, password }),
    });
  } catch {
    throw new Error(apiUnavailableMessage(base));
  }
  if (!res.ok) {
    const text = await res.text();
    try {
      const j = JSON.parse(text) as { message?: string | string[] };
      const m = j.message;
      const msg = Array.isArray(m) ? m.join(', ') : m;
      if (msg) throw new Error(msg);
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e;
    }
    throw new Error(formatApiError(text || res.statusText));
  }
  return res.json() as Promise<{ accessToken: string }>;
}
