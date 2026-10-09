'use client';

import { sessionMustChangePassword } from '@/lib/session';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('gg_token');
}

export function logout() {
  localStorage.removeItem('gg_token');
  try {
    sessionStorage.removeItem('gg_sidebar_company_v1');
  } catch {
    /* ignore */
  }
  window.location.href = '/';
}

export function requireAuth(): boolean {
  if (!getToken()) {
    window.location.href = '/';
    return false;
  }
  return true;
}

/** Redireciona para troca de senha quando o JWT exige primeiro acesso. */
export function requirePasswordChanged(): boolean {
  if (!requireAuth()) return false;
  if (sessionMustChangePassword() && window.location.pathname !== '/trocar-senha') {
    window.location.href = '/trocar-senha';
    return false;
  }
  return true;
}
