import type { Metadata, Viewport } from 'next';
import { PortalLicencasSwRegister } from '@/components/portal-licencas/sw-register';
import { productMetadataIcons } from '@/lib/product-branding';

export const metadata: Metadata = {
  title: { absolute: 'Portal de licenças' },
  applicationName: 'GG Licenças',
  description: 'Provisionamento e gestão de licenças SaaS',
  icons: productMetadataIcons,
  manifest: '/portal-licencas/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: 'GG Licenças',
    statusBarStyle: 'default',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#047857',
};

export default function PortalLicencasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      <PortalLicencasSwRegister />
      {children}
    </div>
  );
}
