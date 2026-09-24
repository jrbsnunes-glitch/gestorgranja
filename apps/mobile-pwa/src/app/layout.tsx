import type { Metadata, Viewport } from 'next';
import { SwRegister } from '@/components/sw-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'GestorGranja Campo',
  description: 'Lançamentos offline no galpão',
  manifest: '/manifest.json',
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
