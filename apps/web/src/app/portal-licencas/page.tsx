'use client';

import { Button, Card } from '@gestor-granja/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { PRODUCT_LOGO_PATH } from '@/lib/product-branding';
import { FormEvent, useEffect, useState } from 'react';
import { inputClass } from '@/components/ui-parts';
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
        <h1 className="mb-6 text-xl font-bold text-slate-900">Portal de licenças</h1>
        <Card title="Acesso operador">
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <input name="username" placeholder="Usuário" className={inputClass} required autoComplete="username" />
            <input
              name="password"
              type="password"
              placeholder="Senha"
              className={inputClass}
              required
              autoComplete="current-password"
            />
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            <Button type="submit">Entrar</Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
