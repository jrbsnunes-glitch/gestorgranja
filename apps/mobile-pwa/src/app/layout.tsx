import type { Metadata, Viewport } from 'next';
import { SwRegister } from '@/components/sw-register';
import { CAMPO_BASE_PATH } from '@/lib/campo-base-path';
import { PRODUCT_LOGO_PATH, PWA_ICON_512 } from '@/lib/product-branding';
import './globals.css';

export const metadata: Metadata = {
  title: 'GestorGranja Campo',
  description: 'Postura e ponto no galpão, com ou sem internet',
  manifest: `${CAMPO_BASE_PATH}/manifest.json`,
  icons: {
    icon: [{ url: PWA_ICON_512, type: 'image/png' }],
    apple: [{ url: PRODUCT_LOGO_PATH, type: 'image/png' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="apple-touch-icon" href={PRODUCT_LOGO_PATH} />
      </head>
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
