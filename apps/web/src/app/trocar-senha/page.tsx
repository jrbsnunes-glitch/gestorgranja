'use client';

import { Button, Card } from '@gestor-granja/ui';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { ErrorBox, Field, SubmitButton, inputClass } from '@/components/ui-parts';
import { changePassword } from '@/lib/api';
import { getToken, logout, requireAuth } from '@/lib/auth';
import { getPostLoginPath } from '@/lib/nav-access';
import { readSession, sessionDisplayName, sessionMustChangePassword } from '@/lib/session';

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!requireAuth()) return;
    if (!sessionMustChangePassword()) {
      router.replace(getPostLoginPath(readSession()));
      return;
    }
    setReady(true);
  }, [router]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const currentPassword = String(fd.get('currentPassword') ?? '');
    const newPassword = String(fd.get('newPassword') ?? '');
    const confirm = String(fd.get('confirmPassword') ?? '');
    if (newPassword !== confirm) {
      setError('A confirmação não coincide com a nova senha.');
      return;
    }
    try {
      const res = await changePassword(currentPassword, newPassword);
      localStorage.setItem('gg_token', res.accessToken);
      router.push(getPostLoginPath(readSession()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar a senha');
    }
  }

  if (!ready || !getToken()) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-50 p-4">
        <p className="text-sm text-slate-500">Carregando…</p>
      </main>
    );
  }

  const session = readSession();

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-1 text-center text-sm font-medium uppercase tracking-wide text-emerald-800">
          Primeiro acesso
        </p>
        <h1 className="mb-2 text-center text-2xl font-bold text-slate-900">Defina sua nova senha</h1>
        <p className="mb-6 text-center text-sm text-slate-600">
          Olá, {sessionDisplayName(session)}. Por segurança, substitua a senha provisória definida pelo
          administrador antes de usar o sistema.
        </p>
        <Card title="Nova senha">
          <ErrorBox message={error} />
          <form className="flex flex-col gap-3" onSubmit={onSubmit}>
            <Field label="Senha atual (provisória)">
              <input
                name="currentPassword"
                type="password"
                className={inputClass}
                required
                autoComplete="current-password"
              />
            </Field>
            <Field label="Nova senha">
              <input
                name="newPassword"
                type="password"
                className={inputClass}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirmar nova senha">
              <input
                name="confirmPassword"
                type="password"
                className={inputClass}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </Field>
            <SubmitButton label="Salvar e entrar no painel" />
            <Button type="button" variant="secondary" className="min-h-11 w-full" onClick={() => logout()}>
              Sair
            </Button>
          </form>
        </Card>
      </div>
    </main>
  );
}
