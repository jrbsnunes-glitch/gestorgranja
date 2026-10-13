'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { cashSessionListHref } from '@/lib/cash-session-nav';

/** Atalho legado — abre o modal na listagem de caixas. */
export default function VendasCaixaSessaoRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  useEffect(() => {
    if (id) router.replace(cashSessionListHref(id));
    else router.replace('/vendas/caixa');
  }, [id, router]);

  return <p className="p-4 text-sm text-slate-600">Abrindo caixa…</p>;
}
