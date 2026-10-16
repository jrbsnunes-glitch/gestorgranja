'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { PortalOperatorLoginForm } from '@/components/license-portal/portal-operator-login-form';
import { PRODUCT_LOGO_PATH } from '@/lib/product-branding';
import { getPortalToken, portalLogin, setPortalToken } from '@/lib/license-portal-api';

export default function PortalLicencasLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (getPortalToken()) {
      router.replace('/portal-licencas/painel');
      return;
    }
    setChecking(false);
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await portalLogin(String(fd.get('username')), String(fd.get('password')));
      setPortalToken(res.accessToken);
      router.push('/portal-licencas/painel');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center p-6">
        <p className="text-sm text-slate-600">Carregando…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <Image
            src={PRODUCT_LOGO_PATH}
            alt="Gestor Granja"
            width={480}
            height={160}
            priority
            className="h-auto w-full max-w-xs object-contain"
          />
        </div>
        <p className="mb-1 text-sm font-medium uppercase tracking-wide text-emerald-800">Operador SaaS</p>
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Portal de licenças</h1>
        <PortalOperatorLoginForm error={error} onSubmit={onSubmit} />
      </div>
    </main>
  );
}
