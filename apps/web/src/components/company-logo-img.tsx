'use client';

import { useCompanyLogoUrl } from '@/hooks/use-company-logo-url';

const reportClass = 'h-20 w-auto max-w-[200px] object-contain object-left print:max-h-[24mm]';
const shellClass = 'h-14 w-auto max-w-[220px] object-contain object-left';

export function CompanyLogoImg({
  logoRegistered,
  variant = 'report',
  alt = 'Logo da empresa',
  className,
  onReady,
}: {
  logoRegistered: string | null | undefined;
  variant?: 'report' | 'shell' | 'inline';
  alt?: string;
  className?: string;
  onReady?: () => void;
}) {
  const src = useCompanyLogoUrl(logoRegistered);
  if (!src) return null;
  const base = variant === 'shell' ? shellClass : variant === 'inline' ? '' : reportClass;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className ? `${base} ${className}` : base}
      onLoad={() => onReady?.()}
      onError={() => onReady?.()}
    />
  );
}
