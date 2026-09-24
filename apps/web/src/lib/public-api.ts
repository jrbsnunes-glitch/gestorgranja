import { formatApiError } from '@/lib/labels';
import { getApiBase } from '@/lib/api';

/** Chamadas à API sem JWT (quiosque público). */
export async function publicApiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(`Não foi possível conectar à API (${base}).`);
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatApiError(text || res.statusText));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
