'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export type CompanyBranding = {
  tradeName: string | null;
  legalName: string;
  logoUrl: string | null;
};

const CACHE_KEY = 'gg_sidebar_company_v1';

export const COMPANY_BRANDING_UPDATED_EVENT = 'gg-company-branding-updated';

export function dispatchCompanyBrandingUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(COMPANY_BRANDING_UPDATED_EVENT));
  }
}

function readCachedCompany(): CompanyBranding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CompanyBranding;
  } catch {
    return null;
  }
}

function writeCachedCompany(c: CompanyBranding) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota / private mode */
  }
}

/** Dados da empresa para marca (logo + nome) — cache em sessionStorage. */
export function useCompanyBranding() {
  const [company, setCompany] = useState<CompanyBranding | null>(() => readCachedCompany());

  useEffect(() => {
    const load = () =>
      void apiFetch<CompanyBranding>('/v1/cadastros/company')
        .then((c) => {
          setCompany(c);
          writeCachedCompany(c);
        })
        .catch(() => undefined);

    load();
    window.addEventListener(COMPANY_BRANDING_UPDATED_EVENT, load);
    return () => window.removeEventListener(COMPANY_BRANDING_UPDATED_EVENT, load);
  }, []);

  return company;
}
