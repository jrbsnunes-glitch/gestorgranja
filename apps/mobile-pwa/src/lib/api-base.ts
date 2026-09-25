const DEFAULT_LOCAL_API = 'http://127.0.0.1:3010/api';

/** Mesma lógica do painel web: `/api` relativo e fallback se build veio com localhost. */
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
