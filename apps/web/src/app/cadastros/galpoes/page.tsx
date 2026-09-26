'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import { AdminShell } from '@/components/admin-shell';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { BARN_SITUATIONS, labelEnum } from '@/lib/labels';
import { readSession, sessionHasPermission } from '@/lib/session';

type Barn = {
  id: string;
  code: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  situation: string;
  responsibleUserId: string | null;
  responsibleName: string | null;
  notes: string | null;
  _count: { flockLots: number };
  activeLots: { id: string; code: string; housedQty: number }[];
  activeLotCount: number;
  housedActive: number;
};

type UserOption = { id: string; name: string; username: string };

function occupancyLabel(b: Barn): string {
  if (!b.capacity) return `${b.housedActive.toLocaleString('pt-BR')} aves`;
  const pct = Math.round((b.housedActive / b.capacity) * 100);
  return `${b.housedActive.toLocaleString('pt-BR')} / ${b.capacity.toLocaleString('pt-BR')} (${pct}%)`;
}

export default function GalpoesPage() {
  const [rows, setRows] = useState<Barn[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Barn | null>(null);
  const list = useCrudList({ items: rows, searchFields: (b) => [b.code, b.name, b.responsibleName] });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);
  const canManage = sessionHasPermission(readSession(), 'operation.settings');

  const load = useCallback(() => {
    void apiFetch<Barn[]>('/v1/cadastros/barns').then(setRows).catch((e) => setError(String(e)));
    if (canManage) {
      void apiFetch<UserOption[]>('/v1/cadastros/barns/responsible-options')
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [canManage]);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: Barn) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      code: fd.get('code'),
      name: fd.get('name'),
      capacity: fd.get('capacity') ? Number(fd.get('capacity')) : null,
      situation: fd.get('situation') || undefined,
      responsibleUserId: (fd.get('responsibleUserId') as string) || null,
      notes: (fd.get('notes') as string) || null,
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/barns/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/cadastros/barns', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function inactivate(row: Barn) {
    if (!confirm(`Inativar galpão ${row.code}?`)) return;
    await apiFetch(`/v1/cadastros/barns/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    load();
  }

  return (
    <AdminShell title="Galpões">
      <PageIntro
        title="Galpões"
        description="Unidades de alojamento e produção: capacidade, situação, responsável e lotes alojados."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={canManage ? () => openForm('include') : undefined}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Código, nome ou responsável…"
      />
      <PaginatedTable
        headers={['Código', 'Nome', 'Situação', 'Ocupação', 'Lotes ativos', 'Responsável', 'Status', 'Ações']}
        recordItems={slice}
        rows={slice.map((b) => [
          b.code,
          b.name,
          <RecordStatusBadge key={`${b.id}-sit`} status={b.situation} />,
          occupancyLabel(b),
          String(b.activeLotCount),
          b.responsibleName ?? '—',
          b.isActive ? 'Ativo' : 'Inativo',
          <RowActions
            key={b.id}
            onView={() => {
              setSelected(b);
              setViewOpen(true);
            }}
            onEdit={canManage ? () => openForm('edit', b) : undefined}
            onInactivate={canManage && b.isActive ? () => void inactivate(b) : undefined}
          />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <FormCadastroModal
        open={modal === 'include' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Alterar galpão' : 'Incluir galpão'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="barn-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="barn-form" onSubmit={save} key={selected?.id ?? 'new'} className="grid gap-0 md:grid-cols-2 md:gap-x-4">
          <Field label="Código">
            <input name="code" className={inputClass} required defaultValue={selected?.code} placeholder="G2" />
          </Field>
          <Field label="Nome">
            <input name="name" className={inputClass} required defaultValue={selected?.name} placeholder="Galpão 2" />
          </Field>
          <Field label="Capacidade (aves)">
            <input
              name="capacity"
              type="number"
              className={inputClass}
              min={0}
              defaultValue={selected?.capacity ?? ''}
            />
          </Field>
          <Field label="Situação">
            <select name="situation" className={inputClass} defaultValue={selected?.situation ?? 'EMPTY'}>
              {BARN_SITUATIONS.map((s) => (
                <option key={s} value={s}>
                  {labelEnum(s)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsável">
            <select name="responsibleUserId" className={inputClass} defaultValue={selected?.responsibleUserId ?? ''}>
              <option value="">—</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name?.trim() || u.username}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Observações">
              <input name="notes" className={inputClass} defaultValue={selected?.notes ?? ''} />
            </Field>
          </div>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar galpão"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Dados',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Nome', value: selected.name },
                    { label: 'Capacidade', value: selected.capacity ?? '—' },
                    { label: 'Ocupação atual', value: occupancyLabel(selected) },
                    { label: 'Situação', value: labelEnum(selected.situation) },
                    { label: 'Responsável', value: selected.responsibleName ?? '—' },
                    { label: 'Status', value: selected.isActive ? 'Ativo' : 'Inativo' },
                    { label: 'Observações', value: selected.notes ?? '—' },
                  ],
                },
                {
                  title: 'Lotes ativos',
                  columns: ['Lote', 'Aves alojadas'],
                  empty: 'Nenhum lote ativo neste galpão.',
                  rows: selected.activeLots.map((l) => [l.code, l.housedQty.toLocaleString('pt-BR')]),
                },
              ]
            : []
        }
      />

      <ModuleReportsModal open={reportsOpen} title="Galpões" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
