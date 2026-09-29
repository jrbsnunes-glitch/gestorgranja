'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatBrl } from '@/lib/money';
import { formatRecordControl } from '@/lib/record-control';
import { isAdminSession, readSession, sessionHasPermission } from '@/lib/session';

type SessionSummary = {
  id: string;
  controlNumber: number;
  status: string;
  reconciliationStatusLabel: string;
  openedAt: string;
  closedAt: string | null;
  salesInflow: number;
  expectedBalance: number;
  closingBalance: number | null;
  variance: number | null;
  isMine: boolean;
  user: { name: string; username: string };
};

function varianceClass(v: number | null) {
  if (v == null) return 'text-slate-500';
  if (Math.abs(v) < 0.01) return 'text-emerald-700 font-medium';
  return v > 0 ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium';
}

export default function VendasCaixaListPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const statusFilter = searchParams.get('status') ?? '';
  const [rows, setRows] = useState<SessionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ take: '120' });
    if (statusFilter) q.set('status', statusFilter);
    void apiFetch<SessionSummary[]>(`/v1/cash/sessions/summary?${q.toString()}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  function canOpenRow(row: SessionSummary) {
    const session = readSession();
    if (!session) return false;
    if (isAdminSession(session) || sessionHasPermission(session, 'cash.reconcile')) return true;
    if (row.status === 'OPEN') {
      return row.isMine && sessionHasPermission(session, 'cash.write');
    }
    if (row.status === 'PENDING_RECONCILIATION') {
      return sessionHasPermission(session, 'cash.reconcile');
    }
    return sessionHasPermission(session, 'cash.read');
  }

  function onRowClick(row: SessionSummary) {
    if (!canOpenRow(row)) return;
    router.push(`/vendas/caixa/sessao/${row.id}`);
  }

  return (
    <AdminShell title="Caixa">
      <PageIntro
        title="Caixa"
        description="Sessões abertas, fechadas e conferidas. Total de vendas = soma das entradas (IN), incluindo lançamentos manuais."
      />
      <ErrorBox message={error} />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/vendas/caixa">
          <Button type="button" variant={statusFilter === '' ? 'primary' : 'secondary'}>
            Todos
          </Button>
        </Link>
        <Link href="/vendas/caixa?status=OPEN">
          <Button type="button" variant={statusFilter === 'OPEN' ? 'primary' : 'secondary'}>
            Abertos
          </Button>
        </Link>
        <Link href="/vendas/caixa?status=PENDING_RECONCILIATION">
          <Button type="button" variant={statusFilter === 'PENDING_RECONCILIATION' ? 'primary' : 'secondary'}>
            Pendente conferência
          </Button>
        </Link>
        <Link href="/vendas/caixa?status=RECONCILED">
          <Button type="button" variant={statusFilter === 'RECONCILED' ? 'primary' : 'secondary'}>
            Conferidos
          </Button>
        </Link>
      </div>

      <ResponsiveTableWrap>
        <table className="w-full min-w-[960px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="px-3 py-2">Controle</th>
              <th className="px-3 py-2">Abertura</th>
              <th className="px-3 py-2">Fechamento</th>
              <th className="px-3 py-2">Operador</th>
              <th className="px-3 py-2 text-right">Total entradas</th>
              <th className="px-3 py-2 text-right">Saldo esperado</th>
              <th className="px-3 py-2 text-right">Informado fech.</th>
              <th className="px-3 py-2 text-right">Diferença</th>
              <th className="px-3 py-2">Situação</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma sessão encontrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const clickable = canOpenRow(row);
                return (
                  <tr
                    key={row.id}
                    onClick={() => onRowClick(row)}
                    className={`border-b border-slate-100 last:border-0 ${
                      clickable ? 'cursor-pointer hover:bg-emerald-50/80 active:bg-emerald-100/60' : 'opacity-90'
                    }`}
                    title={clickable ? 'Clique para abrir a sessão' : undefined}
                  >
                    <td className="px-3 py-2.5 tabular-nums">{formatRecordControl(row.controlNumber)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {new Date(row.openedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {row.closedAt ? new Date(row.closedAt).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {row.user.name}
                      <span className="text-slate-500"> ({row.user.username})</span>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(row.salesInflow)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(row.expectedBalance)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(row.closingBalance)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${varianceClass(row.variance)}`}>
                      {row.variance != null ? formatBrl(row.variance) : '—'}
                    </td>
                    <td className="px-3 py-2.5">{row.reconciliationStatusLabel}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ResponsiveTableWrap>
    </AdminShell>
  );
}
