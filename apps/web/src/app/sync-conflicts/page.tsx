'use client';

import { useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { DetailGrid, ListToolbar, Modal, PaginatedTable, RowActions, usePagination } from '@/components/list-crud';
import { apiFetch } from '@/lib/api';
import { humanizeUserText } from '@/lib/humanize-user-text';
import { labelEnum } from '@/lib/labels';

type Conflict = {
  id: string;
  operationId: string;
  entityType: string;
  createdAt: string;
  clientPayload: unknown;
  serverPayload?: unknown;
};

export default function SyncConflictsPage() {
  const [rows, setRows] = useState<Conflict[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<Conflict | null>(null);

  useEffect(() => {
    void apiFetch<Conflict[]>('/v1/sync/conflicts').then(setRows).catch(() => setRows([]));
  }, []);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [r.entityType, r.operationId],
    dateField: (r) => r.createdAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  return (
    <AdminShell title="Conflitos de sincronização">
      <PageIntro
        title="Conflitos de sincronização"
        description="Operações do app de campo que divergiram do servidor e aguardam análise."
      />
      <ListToolbar
        list={list}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Entidade, operação…"
        showDateFilter
      />
      {total === 0 ? (
        <p className="text-slate-600">Nenhum conflito pendente.</p>
      ) : (
        <PaginatedTable
          headers={['Data', 'Registro', 'Situação', 'Ações']}
          recordItems={slice}
          rows={slice.map((r) => [
            new Date(r.createdAt).toLocaleString('pt-BR'),
            labelEnum(r.entityType),
            'Aguardando revisão',
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
      )}

      <Modal title="Detalhe do conflito" open={viewOpen} onClose={() => setViewOpen(false)} wide>
        {selected ? (
          <>
            <DetailGrid
              entries={[
                ['Data', new Date(selected.createdAt).toLocaleString('pt-BR')],
                ['Registro', labelEnum(selected.entityType)],
                ['Situação', 'Conflito entre app de campo e servidor'],
              ]}
            />
            {selected.serverPayload != null &&
            typeof selected.serverPayload === 'object' &&
            selected.serverPayload !== null &&
            'error' in (selected.serverPayload as object) ? (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {humanizeUserText(String((selected.serverPayload as { error?: string }).error ?? ''))}
              </p>
            ) : null}
            <p className="mt-4 text-sm font-medium text-slate-700">Payload do campo</p>
            <pre className="mt-1 overflow-auto rounded bg-slate-100 p-2 text-xs">
              {JSON.stringify(selected.clientPayload, null, 2)}
            </pre>
            {selected.serverPayload != null ? (
              <>
                <p className="mt-2 text-sm font-medium text-slate-700">Resposta do servidor</p>
                <pre className="mt-1 overflow-auto rounded bg-amber-50 p-2 text-xs">
                  {JSON.stringify(selected.serverPayload, null, 2)}
                </pre>
              </>
            ) : null}
          </>
        ) : null}
      </Modal>

      <ModuleReportsModal
        open={reportsOpen}
        title="Conflitos de sync"
        onClose={() => setReportsOpen(false)}
        compactLauncher
      />
    </AdminShell>
  );
}
