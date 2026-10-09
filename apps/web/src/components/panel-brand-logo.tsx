'use client';

import { CompanyLogoImg } from '@/components/company-logo-img';
import { useCompanyBranding } from '@/hooks/use-company-branding';
import { PANEL_MENU_LOGO_PATH } from '@/lib/product-branding';

const shellClass = 'h-14 w-auto max-w-[220px] object-contain object-center';

/** Logo estática quando a empresa ainda não enviou identidade visual. */
export function PanelBrandLogo({
  className,
  alt = 'Logo',
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={PANEL_MENU_LOGO_PATH} alt={alt} className={className ? `${shellClass} ${className}` : shellClass} />
  );
}

/** Logo principal do sistema: cadastro da empresa, com fallback estático. */
export function PrimaryBrandLogo({
  className,
  alt = 'Logo da empresa',
}: {
  className?: string;
  alt?: string;
}) {
  const company = useCompanyBranding();
  const layoutClass =
    className ??
    'mx-auto mb-3 !h-[4.75rem] !max-w-[min(100%,13rem)] object-contain object-center';

  if (company?.logoUrl) {
    return (
      <CompanyLogoImg logoRegistered={company.logoUrl} variant="shell" alt={alt} className={layoutClass} />
    );
  }

  return <PanelBrandLogo className={layoutClass} alt={alt} />;
}
