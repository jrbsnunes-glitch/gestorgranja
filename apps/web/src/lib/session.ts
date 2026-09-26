'use client';

import { getToken } from '@/lib/auth';

export type SessionUser = {
  sub: string;
  username: string;
  name: string;
  permissions: string[];
  roles: string[];
};

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function readSession(): SessionUser | null {
  const token = getToken();
  if (!token) return null;
  const p = decodeJwtPayload(token);
  if (!p || typeof p.sub !== 'string') return null;
  return {
    sub: p.sub,
    username: typeof p.username === 'string' ? p.username : '',
    name: typeof p.name === 'string' ? p.name : '',
    permissions: Array.isArray(p.permissions) ? (p.permissions as string[]) : [],
    roles: Array.isArray(p.roles) ? (p.roles as string[]) : [],
  };
}

/** Nome de exibição na UI (nome cadastrado ou login). */
export function sessionDisplayName(session: SessionUser | null): string {
  if (!session) return '';
  const name = session.name.trim();
  return name || session.username;
}

export function isAdminSession(session: SessionUser | null): boolean {
  return !!session?.permissions.includes('*');
}

/** Sessão possui a permissão (admin `*` sempre tem). */
export function sessionHasPermission(session: SessionUser | null, code: string): boolean {
  if (!session) return false;
  return session.permissions.includes('*') || session.permissions.includes(code);
}
