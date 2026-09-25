import type { Metadata } from 'next';
import { productMetadataIcons } from '@/lib/product-branding';

export const metadata: Metadata = {
  title: 'Portal de licenças',
  description: 'Provisionamento e gestão de licenças SaaS',
  icons: productMetadataIcons,
};

export default function PortalLicencasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {children}
    </div>
  );
}
