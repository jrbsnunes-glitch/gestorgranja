/** Logo padrão GestorGranja (login, portal). */
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
