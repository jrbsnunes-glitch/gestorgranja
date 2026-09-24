'use client';

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
