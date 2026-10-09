import { MORTALIDADE_MENU_ICON_PATH, PANEL_MENU_LOGO_PATH } from '@/lib/product-branding';

/** Ícones das abas Operação (Painel, Lotes, Produção…) — mesmo visual dos dashboards. */
export const OPERACAO_TAB_ICONS: Record<string, string> = {
  dashboard: PANEL_MENU_LOGO_PATH,
  lotes: PANEL_MENU_LOGO_PATH,
  producao: '/producao/ovo.svg',
  mortalidade: MORTALIDADE_MENU_ICON_PATH,
  relatorios: '/producao/grafico.svg',
  'registro-diario': '/producao/calendario.svg',
  galpoes: '/producao/galpao.svg',
  ocorrencias: '/producao/calendario.svg',
  insumos: '/icons/record-view/product.svg',
  perdas: '/producao/mortalidade.svg',
  pendencias: '/icons/record-view/status.svg',
  sanidade: '/producao/galinha.svg',
  configuracoes: '/icons/record-view/generic.svg',
};

export function operacaoTabIcon(tabId: string): string {
  return OPERACAO_TAB_ICONS[tabId] ?? '/producao/ovo.svg';
}

/** Ícones do painel zootécnico / home (KPIs ilustrados). */
export const OPERACAO_DASHBOARD_KPI_ICONS = {
  birds: PANEL_MENU_LOGO_PATH,
  eggs: '/producao/ovo.svg',
  layRate: '/producao/grafico.svg',
  mortality: MORTALIDADE_MENU_ICON_PATH,
  lots: PANEL_MENU_LOGO_PATH,
  review: '/icons/record-view/status.svg',
  occurrences: '/producao/calendario.svg',
  eggsStock: '/producao/ovo.svg',
  critical: '/icons/record-view/quantity.svg',
} as const;
