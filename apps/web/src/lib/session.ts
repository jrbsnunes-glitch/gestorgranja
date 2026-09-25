'use client';

import { getToken } from '@/lib/auth';

export type SessionUser = {
  sub: string;
  username: string;
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
    permissions: Array.isArray(p.permissions) ? (p.permissions as string[]) : [],
    roles: Array.isArray(p.roles) ? (p.roles as string[]) : [],
  };
}

export function isAdminSession(session: SessionUser | null): boolean {
  return !!session?.permissions.includes('*');
}
