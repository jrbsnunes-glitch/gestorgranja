'use client';

import { useEffect, useState } from 'react';
import { getApiBase, getToken } from '@/lib/api';

/** Carrega blob URL autenticada do logo quando `logoRegistered` está definido (ex.: company.logoUrl). */
export function useCompanyLogoUrl(logoRegistered: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!logoRegistered) {
      setUrl(null);
      return;
    }
    const token = getToken();
    if (!token) return;

    let alive = true;
    let objectUrl: string | null = null;

    void fetch(`${getApiBase()}/v1/cadastros/company/logo`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (!alive || !blob) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setUrl(null);
      });

    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [logoRegistered]);

  return url;
}
