'use client';

import { PrimaryBrandLogo } from '@/components/panel-brand-logo';
import { useCompanyBranding } from '@/hooks/use-company-branding';

export function SidebarBrand() {
  const company = useCompanyBranding();
  const displayName = company?.tradeName ?? company?.legalName ?? 'GestorGranja';

  return (
    <div className="min-w-0 flex-1 text-center">
      <PrimaryBrandLogo />
      <p className="text-lg font-bold leading-tight text-emerald-800">{displayName}</p>
      <p className="mt-0.5 text-xs text-slate-500">Painel gerencial</p>
    </div>
  );
}
