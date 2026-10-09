'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminShell } from '@/components/admin-shell';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { DetailGrid, ListToolbar, Modal, PaginatedTable, RowActions, usePagination } from '@/components/list-crud';
import { apiFetch } from '@/lib/api';
import {
  formatAuditAction,
  formatAuditEntity,
  formatAuditReference,
  formatAuditSummary,
} from '@/lib/audit-log-labels';

type AuditRow = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  reason?: string | null;
  createdAt: string;
  afterJson?: unknown;
  beforeJson?: unknown;
  user: { username: string; name: string } | null;
};

function buildLogsQuery(entity: string | null, entityId: string | null, limit: number) {
  const q = new URLSearchParams();
  q.set('limit', String(limit));
  if (entity) q.set('entity', entity);
  if (entityId) q.set('entityId', entityId);
  return q.toString();
}

export default function LogsPage() {
  const searchParams = useSearchParams();
  const filterEntity = searchParams.get('entity')?.trim() || null;
  const filterEntityId = searchParams.get('entityId')?.trim() || null;

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const recordFilter = Boolean(filterEntity && filterEntityId);

  const load = useCallback(() => {
    const qs = buildLogsQuery(filterEntity, filterEntityId, recordFilter ? 200 : 200);
    void apiFetch<AuditRow[]>(`/v1/audit/logs?${qs}`).then(setRows);
  }, [filterEntity, filterEntityId, recordFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [
      formatAuditAction(r.action),
      formatAuditEntity(r.entity),
      formatAuditReference(r),
      formatAuditSummary(r),
      r.reason ?? '',
      r.user?.username,
      r.user?.name,
    ],
    dateField: (r) => r.createdAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const intro = useMemo(() => {
    if (recordFilter) {
      return {
        title: 'Histórico de alterações',
        description: `Eventos de auditoria do registro (${formatAuditEntity(filterEntity!)}). Use a busca ou o filtro de datas para refinar.`,
      };
    }
    return {
      title: 'Logs de auditoria',
      description:
        'Registros recentes de ações no sistema. Para ver alterações de um lançamento específico, use o link “Ver histórico em Logs” na visualização do registro.',
    };
  }, [recordFilter, filterEntity]);

  return (
    <AdminShell title="Logs">
      <PageIntro title={intro.title} description={intro.description} />
      {recordFilter ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-950">
          <span>
            Filtrando: <strong>{formatAuditEntity(filterEntity!)}</strong>
            <span className="ml-1 font-mono text-xs text-emerald-800">{filterEntityId}</span>
          </span>
          <Link href="/logs" className="font-medium text-emerald-800 underline-offset-2 hover:underline">
            Ver todos os logs
          </Link>
        </div>
      ) : null}
      <ListToolbar
        list={list}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Ação, módulo, referência, usuário, justificativa…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Data', 'Usuário', 'Ação', 'Módulo', 'Justificativa', 'Referência', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          new Date(r.createdAt).toLocaleString('pt-BR'),
          r.user ? `${r.user.username} (${r.user.name})` : '—',
          formatAuditAction(r.action),
          formatAuditEntity(r.entity),
          r.reason?.trim() || '—',
          formatAuditReference(r),
          <RowActions
            key={r.id}
            onView={() => {
              setSelected(r);
              setViewOpen(true);
            }}
          />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <Modal title="Registro de auditoria" open={viewOpen} onClose={() => setViewOpen(false)} wide>
        {selected ? (
          <>
            <p className="mb-4 text-sm text-slate-700">{formatAuditSummary(selected)}</p>
            <DetailGrid
              entries={[
                ['Data', new Date(selected.createdAt).toLocaleString('pt-BR')],
                ['Usuário', selected.user ? `${selected.user.username} (${selected.user.name})` : '—'],
                ['Ação', formatAuditAction(selected.action)],
                ['Módulo', formatAuditEntity(selected.entity)],
                ['Justificativa', selected.reason?.trim() || '—'],
                ['Referência', formatAuditReference(selected)],
              ]}
            />
          </>
        ) : null}
      </Modal>

      <ModuleReportsModal open={reportsOpen} title="Logs" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
