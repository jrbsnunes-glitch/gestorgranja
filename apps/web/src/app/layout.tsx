import type { Metadata } from 'next';
import { productMetadataIcons } from '@/lib/product-branding';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'GestorGranja',
    template: '%s — GestorGranja',
  },
  description: 'Gestão avicultura de postura',
  icons: productMetadataIcons,
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/favicon.png" type="image/png" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-icon" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
