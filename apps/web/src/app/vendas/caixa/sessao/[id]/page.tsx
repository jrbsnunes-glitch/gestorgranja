'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { CashSessionWorkspacePage } from '@/components/cash/cash-session-workspace-page';

export default function VendasCaixaSessaoPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : '';

  return (
    <AdminShell title="Caixa">
      <p className="mb-2 text-sm">
        <Link href="/vendas/caixa" className="font-medium text-emerald-800 hover:underline">
          ← Voltar à lista de caixas
        </Link>
      </p>
      <PageIntro title="Sessão de caixa" description="Movimentos, fechamento ou consulta da sessão selecionada." />
      <CashSessionWorkspacePage focusSessionId={id} embedded />
    </AdminShell>
  );
}
