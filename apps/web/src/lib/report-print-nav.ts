const RETURN_KEY = 'gg_report_return_href';

/** Rotas intermediárias ou de impressão — não substituir URL de retorno ao encadear passos. */
function isReportFlowRoute(pathname: string): boolean {
  if (pathname === '/relatorio') return true;
  return pathname.startsWith('/relatorios/') && pathname.includes('/impressao');
}

function currentReturnHref(): string {
  return `${window.location.pathname}${window.location.search}`;
}

/** Abre a rota de impressão na mesma aba (diálogo de impressão do sistema em seguida). */
export function navigateToReportPrint(path: string, returnHref?: string) {
  if (typeof window !== 'undefined') {
    if (returnHref?.trim() && returnHref.trim().startsWith('/')) {
      sessionStorage.setItem(RETURN_KEY, returnHref.trim());
    } else if (!isReportFlowRoute(window.location.pathname)) {
      sessionStorage.setItem(RETURN_KEY, currentReturnHref());
    } else if (!sessionStorage.getItem(RETURN_KEY)) {
      sessionStorage.setItem(RETURN_KEY, currentReturnHref());
    }
  }
  window.location.assign(path);
}

/** Volta à tela em que o usuário estava antes de abrir o relatório. */
export function closeReportPrintView() {
  if (typeof window === 'undefined') return;

  const saved = sessionStorage.getItem(RETURN_KEY);
  if (saved) {
    sessionStorage.removeItem(RETURN_KEY);
    window.location.assign(saved);
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
    return;
  }

  window.location.assign('/');
}
