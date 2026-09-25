import type { Metadata, Viewport } from 'next';
import { SwRegister } from '@/components/sw-register';
import { CAMPO_BASE_PATH } from '@/lib/campo-base-path';
import './globals.css';

export const metadata: Metadata = {
  title: 'GestorGranja Campo',
  description: 'Postura e ponto no galpão, com ou sem internet',
  manifest: `${CAMPO_BASE_PATH}/manifest.json`,
};

export const viewport: Viewport = {
  themeColor: '#047857',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
