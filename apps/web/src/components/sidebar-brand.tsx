'use client';

import { useEffect, useState } from 'react';
import { CompanyLogoImg } from '@/components/company-logo-img';
import { apiFetch } from '@/lib/api';

type Company = {
  tradeName: string | null;
  legalName: string;
  logoUrl: string | null;
};

const CACHE_KEY = 'gg_sidebar_company_v1';

function readCachedCompany(): Company | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Company;
  } catch {
    return null;
  }
}

function writeCachedCompany(c: Company) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota / private mode */
  }
}

export function SidebarBrand() {
  const [company, setCompany] = useState<Company | null>(() => readCachedCompany());

  useEffect(() => {
    void apiFetch<Company>('/v1/cadastros/company')
      .then((c) => {
        setCompany(c);
        writeCachedCompany(c);
      })
      .catch(() => undefined);
  }, []);

  const displayName = company?.tradeName ?? company?.legalName ?? 'GestorGranja';

  return (
    <div className="min-w-0 flex-1">
      <CompanyLogoImg logoRegistered={company?.logoUrl} variant="shell" className="mb-2" />
      <p className="text-lg font-bold text-emerald-800">{displayName}</p>
      <p className="text-xs text-slate-500">Painel gerencial</p>
    </div>
  );
}
