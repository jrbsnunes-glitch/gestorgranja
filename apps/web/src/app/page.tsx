'use client';

import { Button, Card } from '@gestor-granja/ui';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { inputClass } from '@/components/ui-parts';
import { login } from '@/lib/api';
import { getPostLoginPath } from '@/lib/nav-access';
import { readSession } from '@/lib/session';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await login(
        String(fd.get('tenantSlug')),
        String(fd.get('username')),
        String(fd.get('password')),
      );
      localStorage.setItem('gg_token', res.accessToken);
      router.push(getPostLoginPath(readSession()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login');
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col md:flex-row">
      <section
        className="relative flex min-h-[220px] flex-1 flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-6 py-10 md:min-h-0 md:py-12"
        aria-label="Identidade Gestor Granja"
      >
        <div className="w-full max-w-lg md:max-w-xl">
          <Image
            src="/branding/login-logo.png"
            alt="Gestor Granja — ERP avícola"
            width={1200}
            height={800}
            priority
            className="h-auto w-full object-contain"
          />
        </div>
        <p className="mt-6 hidden max-w-md text-center text-sm text-slate-600 md:block">
          Gestão integrada de produção, financeiro, estoque e operação da granja.
        </p>
      </section>

      <section className="flex flex-1 flex-col justify-center border-t border-slate-200 bg-white px-4 py-8 sm:px-8 md:border-l md:border-t-0 md:py-12 lg:px-12">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-1 text-sm font-medium uppercase tracking-wide text-emerald-800">Acesso</p>
          <h1 className="mb-6 text-2xl font-bold text-slate-900">Entrar no painel</h1>
          <Card title="Credenciais">
            <form className="flex flex-col gap-3" onSubmit={onSubmit}>
              <input
                name="tenantSlug"
                placeholder="Granja (slug)"
                className={inputClass}
                required
                autoComplete="organization"
              />
              <input
                name="username"
                placeholder="Usuário"
                className={inputClass}
                required
                autoComplete="username"
              />
              <input
                name="password"
                type="password"
                placeholder="Senha"
                className={inputClass}
                required
                autoComplete="current-password"
              />
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
              <Button type="submit" className="min-h-11 w-full">
                Acessar painel
              </Button>
            </form>
          </Card>
        </div>
      </section>
    </main>
  );
}
