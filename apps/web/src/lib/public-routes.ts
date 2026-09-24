/** Rotas sem menu lateral nem checagem de shell autenticado. */
export function isPublicAppRoute(pathname: string): boolean {
  if (pathname === '/') return true;
  if (pathname.startsWith('/relatorios/')) return true;
  if (pathname === '/rh/ponto/quiosque') return true;
  if (pathname.startsWith('/rh/ponto/terminal/kiosk')) return true;
  return false;
}
