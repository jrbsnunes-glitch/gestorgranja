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
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type Barn = {
  id: string;
  code: string;
  name: string;
  capacity: number | null;
  isActive: boolean;
  _count: { flockLots: number };
};

export default function GalpoesPage() {
  const [rows, setRows] = useState<Barn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Barn | null>(null);
  const list = useCrudList({ items: rows, searchFields: (b) => [b.code, b.name] });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Barn[]>('/v1/cadastros/barns').then(setRows).catch((e) => setError(String(e)));
  }, []);

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
      capacity: fd.get('capacity') ? Number(fd.get('capacity')) : undefined,
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
      <PageIntro title="Galpões" description="Unidades de alojamento e produção." />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => openForm('include')}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Código ou nome…"
      />
      <PaginatedTable
        headers={['Código', 'Nome', 'Capacidade', 'Lotes', 'Status', 'Ações']}
        recordItems={slice}
        rows={slice.map((b) => [
          b.code,
          b.name,
          b.capacity?.toString() ?? '—',
          String(b._count.flockLots),
          b.isActive ? 'Ativo' : 'Inativo',
          <RowActions
            key={b.id}
            onView={() => {
              setSelected(b);
              setViewOpen(true);
            }}
            onEdit={() => openForm('edit', b)}
            onInactivate={b.isActive ? () => void inactivate(b) : undefined}
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
        <form id="barn-form" onSubmit={save} key={selected?.id ?? 'new'}>
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
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar galpão"
        sections={
          selected
            ? [
                {
                  title: 'Dados',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Nome', value: selected.name },
                    { label: 'Capacidade', value: selected.capacity ?? '—' },
                    { label: 'Lotes', value: selected._count.flockLots },
                    { label: 'Status', value: selected.isActive ? 'Ativo' : 'Inativo' },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal open={reportsOpen} title="Galpões" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
