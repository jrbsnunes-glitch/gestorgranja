import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Portal de licenças',
  description: 'Provisionamento e gestão de licenças SaaS',
};

export default function PortalLicencasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-slate-50 text-slate-900">
      {children}
    </div>
  );
}
