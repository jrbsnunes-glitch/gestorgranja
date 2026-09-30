'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redireciona para a listagem com o modal de inclusão aberto. */
export default function IncluirNfeRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/vendas/documentos-fiscais?incluir=1');
  }, [router]);
  return null;
}
