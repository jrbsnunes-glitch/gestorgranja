/** Logo do menu Painel (barra lateral, aba Painel na Operação, cabeçalho /dashboard). */
export const PANEL_MENU_LOGO_PATH = '/branding/silhueta-galinha-azul.png';

/** Ícone do menu Mortalidade (aba Operação e barra inferior). */
export const MORTALIDADE_MENU_ICON_PATH = '/producao/silhueta-galinha-erp.png';

/** Logo padrão GestorGranja (login, portal) — mesmo arquivo do Painel. */
export const PRODUCT_LOGO_PATH = '/branding/login-logo.png';

/** Favicon estático + ícones do App Router (app/icon.png, app/apple-icon.png). */
export const productMetadataIcons = {
  icon: [
    { url: '/favicon.png', type: 'image/png' as const },
    { url: '/favicon.ico', type: 'image/x-icon' as const },
  ],
  shortcut: '/favicon.ico',
  apple: [{ url: '/apple-icon', type: 'image/png' as const }],
};
