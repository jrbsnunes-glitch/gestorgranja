import { formatApiError } from '@/lib/labels';
import { getApiBase } from '@/lib/api';

const PORTAL_TOKEN_KEY = 'gg_portal_token';

export type PortalPlan = {
  code: string;
  label: string;
  entryFeeBrl: number;
  monthlyFeeBrl: number;
};

export type PortalTenant = {
  id: string;
  slug: string;
  cnpj: string;
  companyName: string;
  licenseStatus: string;
  licenseExpiresAt: string | null;
  commercialPlan: string;
  planLabel: string;
  entryFeeBrl: number;
  monthlyFeeBrl: number;
  provisionAdminEmail: string | null;
  databaseName: string;
  provisioningStatus: string;
};

export type PortalTotals = {
  entryFeeBrl: number;
  monthlyFeeBrl: number;
  activeClientCount: number;
};

export function getPortalToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalToken() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
}

async function portalFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getPortalToken();
  const base = getApiBase();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(formatApiError(text || res.statusText));
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function portalLogin(username: string, password: string) {
  return portalFetch<{ accessToken: string; expiresIn: number }>('/v1/license-portal/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchPortalPlans() {
  return portalFetch<PortalPlan[]>('/v1/license-portal/plans');
}

export function fetchPortalTenants() {
  return portalFetch<{ items: PortalTenant[]; totals: PortalTotals }>('/v1/license-portal/tenants');
}

export function provisionPortalTenant(body: Record<string, unknown>) {
  return portalFetch<PortalTenant>('/v1/license-portal/tenants', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function revalidatePortalLicense(slug: string, months = 1) {
  return portalFetch<PortalTenant>(`/v1/license-portal/tenants/${encodeURIComponent(slug)}/license/revalidate`, {
    method: 'PATCH',
    body: JSON.stringify({ months }),
  });
}

export function pausePortalLicense(slug: string) {
  return portalFetch<PortalTenant>(
    `/v1/license-portal/tenants/${encodeURIComponent(slug)}/license/pause`,
    { method: 'PATCH', body: '{}' },
  );
}

export function activatePortalLicense(slug: string, plan: string, entryPaidAt?: string) {
  return portalFetch<PortalTenant>(
    `/v1/license-portal/tenants/${encodeURIComponent(slug)}/license/activate`,
    {
      method: 'PATCH',
      body: JSON.stringify({ plan, entryPaidAt }),
    },
  );
}

export function archivePortalTenant(slug: string) {
  return portalFetch<PortalTenant>(`/v1/license-portal/tenants/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}

export function updatePortalAdminPassword(slug: string, newPassword: string) {
  return portalFetch<{ ok: boolean }>(
    `/v1/license-portal/tenants/${encodeURIComponent(slug)}/admin-password`,
    {
      method: 'PATCH',
      body: JSON.stringify({ newPassword }),
    },
  );
}

export function formatBrl(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
