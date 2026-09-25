import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

/** Logo padrão do produto (login, favicon e abas do navegador). */
const PRODUCT_LOGO = '/branding/login-logo.png';

export const metadata: Metadata = {
  title: {
    default: 'GestorGranja',
    template: '%s — GestorGranja',
  },
  description: 'Gestão avicultura de postura',
  icons: {
    icon: [{ url: PRODUCT_LOGO, type: 'image/png' }],
    shortcut: PRODUCT_LOGO,
    apple: [{ url: PRODUCT_LOGO, type: 'image/png' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
