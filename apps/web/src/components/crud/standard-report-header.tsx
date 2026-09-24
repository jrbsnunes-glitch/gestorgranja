'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CompanyLogoImg } from '@/components/company-logo-img';
import { apiFetch } from '@/lib/api';

type Company = { legalName: string; tradeName: string | null; cnpj?: string | null; logoUrl?: string | null };
type Branding = Company & { logoDataUrl: string | null };

export function StandardReportHeader({
  documentTitle,
  documentExtras,
}: {
  documentTitle: string;
  documentExtras?: ReactNode;
}) {
  const [branding, setBranding] = useState<Branding | null>(null);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  useEffect(() => {
    void apiFetch<Branding>('/v1/cadastros/company/branding')
      .then(setBranding)
      .catch(() => {
        void apiFetch<Company>('/v1/cadastros/company').then((c) =>
          setBranding({ ...c, logoDataUrl: null }),
        );
      });
  }, []);

  useEffect(() => {
    const onBeforePrint = () => setGeneratedAt(new Date());
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  const name = branding?.tradeName ?? branding?.legalName ?? 'GestorGranja';

  return (
    <header className="mb-4 border-b border-slate-300 pb-3 print:mb-6">
      <div className="flex items-start gap-4">
        {branding?.logoDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoDataUrl}
            alt="Logo da empresa"
            className="report-header-logo h-16 w-auto max-w-[180px] shrink-0 object-contain object-left print:max-h-[22mm]"
          />
        ) : (
          <CompanyLogoImg logoRegistered={branding?.logoUrl} variant="report" className="shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-slate-900">{name}</p>
          {branding?.cnpj ? <p className="text-xs text-slate-600">CNPJ {branding.cnpj}</p> : null}
          <h1 className="mt-2 text-base font-semibold tracking-tight text-slate-800">{documentTitle}</h1>
          {documentExtras}
          <p className="mt-2 text-xs text-slate-500">
            Gerado em {generatedAt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' })}
          </p>
        </div>
      </div>
    </header>
  );
}
