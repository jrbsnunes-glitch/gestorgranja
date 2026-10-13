/** Abre a sessão na listagem de caixas (modal via query `session`). */
export function cashSessionListHref(sessionId: string) {
  return `/vendas/caixa?session=${encodeURIComponent(sessionId)}`;
}

export const CASH_SESSION_QUERY_PARAM = 'session';
