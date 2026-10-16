'use client';

import { Button, Card } from '@gestor-granja/ui';
import Link from 'next/link';
import { FormEvent } from 'react';
import { inputClass } from '@/components/ui-parts';

type Props = {
  error: string | null;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  showGranjaLink?: boolean;
};

/** Login do operador SaaS — um acesso para todos os clientes (sem slug de granja). */
export function PortalOperatorLoginForm({ error, onSubmit, showGranjaLink = true }: Props) {
  return (
    <>
      <p className="mb-4 text-sm text-slate-600">
        Credenciais do <strong>operador SaaS</strong> (não são login de uma granja). Um único acesso lista e
        gerencia <strong>todos os clientes</strong> — sem campo de slug.
      </p>
      <p className="mb-4 text-xs text-slate-500">
        Atalho no celular: com esta página aberta (<strong>/portal-licencas</strong>), use &quot;Adicionar à tela
        inicial&quot;. Remova atalhos antigos que abrem só o site principal.
      </p>
      <Card title="Acesso operador">
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <input
            name="username"
            placeholder="Usuário do operador"
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
          <Button type="submit">Entrar no portal</Button>
        </form>
      </Card>
      {showGranjaLink ? (
        <p className="mt-4 text-center text-xs text-slate-500">
          Acesso à <strong>granja</strong> (slug + usuário + senha)?{' '}
          <Link href="/" className="text-emerald-800 underline">
            Login do painel da granja
          </Link>
        </p>
      ) : null}
    </>
  );
}
