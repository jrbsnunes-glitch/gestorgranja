'use client';

import { useEffect, useState, type ReactNode } from 'react';

export type ReportCompanyBranding = {
  legalName: string;
  tradeName: string | null;
  cnpj: string | null;
  logoUrl?: string | null;
  logoDataUrl: string | null;
};

export function CorporateCashReportHeader({
  documentTitle,
  subtitle,
  reportRef,
  branding,
  onBrandingReady,
}: {
  documentTitle: string;
  subtitle?: ReactNode;
  reportRef?: string;
  branding: ReportCompanyBranding;
  onBrandingReady?: () => void;
}) {
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  useEffect(() => {
    const onBeforePrint = () => setGeneratedAt(new Date());
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  useEffect(() => {
    if (!branding.logoDataUrl) {
      onBrandingReady?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reavalia quando a logo embutida muda
  }, [branding.logoDataUrl]);

  const name = branding.tradeName ?? branding.legalName ?? 'GestorGranja';
  const logoSrc = branding.logoDataUrl;

  return (
    <>
      <div className="corp-top">
        <div className="corp-brand-row">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Logo da empresa"
              className="corp-logo"
              onLoad={() => onBrandingReady?.()}
              onError={() => onBrandingReady?.()}
            />
          ) : null}
          <div>
            <p className="corp-company">{name}</p>
            {branding.cnpj ? <p className="corp-company-meta">CNPJ {branding.cnpj}</p> : null}
          </div>
        </div>
        <div className="corp-doc-meta">
          {reportRef ? <strong>Ref. {reportRef}</strong> : null}
          <span>
            Emissão:{' '}
            {generatedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
          </span>
        </div>
      </div>
      <div className="corp-title-band">
        <h1>{documentTitle}</h1>
        {subtitle ? <div>{subtitle}</div> : null}
      </div>
    </>
  );
}
