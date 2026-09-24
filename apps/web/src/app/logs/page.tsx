'use client';

import { useCallback, useEffect, useState } from 'react';
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
  createdAt: string;
  afterJson?: unknown;
  beforeJson?: unknown;
  user: { username: string; name: string } | null;
};

export default function LogsPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const load = useCallback(() => {
    void apiFetch<AuditRow[]>('/v1/audit/logs?limit=200').then(setRows);
  }, []);

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
      r.user?.username,
      r.user?.name,
    ],
    dateField: (r) => r.createdAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  return (
    <AdminShell title="Logs">
      <PageIntro title="Logs de auditoria" description="Registros recentes de ações no sistema (até 200 últimos)." />
      <ListToolbar
        list={list}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Ação, módulo, referência, usuário…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Data', 'Usuário', 'Ação', 'Módulo', 'Referência', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          new Date(r.createdAt).toLocaleString('pt-BR'),
          r.user ? `${r.user.username} (${r.user.name})` : '—',
          formatAuditAction(r.action),
          formatAuditEntity(r.entity),
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
