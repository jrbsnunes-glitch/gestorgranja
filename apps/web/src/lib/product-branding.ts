/** Logo padrão GestorGranja (login, portal, favicon). */
export const PRODUCT_LOGO_PATH = '/branding/login-logo.png';

export const productMetadataIcons = {
  icon: [{ url: PRODUCT_LOGO_PATH, type: 'image/png' as const }],
  shortcut: PRODUCT_LOGO_PATH,
  apple: [{ url: PRODUCT_LOGO_PATH, type: 'image/png' as const }],
};
