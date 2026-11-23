'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type Veterinarian = {
  id: string;
  name: string;
  crmv: string;
  phone: string | null;
  email: string | null;
  isResponsible: boolean;
  isActive: boolean;
};

export default function VeterinariosPage() {
  const [rows, setRows] = useState<Veterinarian[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Veterinarian | null>(null);

  const list = useCrudList({ items: rows, searchFields: (r) => [r.name, r.crmv, r.phone, r.email] });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);
  const hasResponsible = rows.some((r) => r.isResponsible && r.isActive);

  const load = useCallback(() => {
    void apiFetch<Veterinarian[]>('/v1/cadastros/veterinarians')
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar veterinários'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: Veterinarian) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get('name') ?? ''),
      crmv: String(fd.get('crmv') ?? ''),
      phone: String(fd.get('phone') ?? ''),
      email: String(fd.get('email') ?? ''),
      isResponsible: fd.get('isResponsible') === '1',
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/veterinarians/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/v1/cadastros/veterinarians', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function inactivate(row: Veterinarian) {
    await apiFetch(`/v1/cadastros/veterinarians/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    load();
  }

  async function remove(row: Veterinarian) {
    if (!confirm(`Excluir o veterinário ${row.name}?`)) return;
    try {
      await apiFetch(`/v1/cadastros/veterinarians/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Veterinários">
      <PageIntro
        title="Veterinários"
        description="Médicos veterinários da granja. O responsável técnico assina a ficha PL 5 de manejo."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => openForm('include')}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Nome ou CRMV…"
      />
      <PaginatedTable
        headers={['Nome', 'CRMV', 'Telefone', 'Responsável técnico', 'Ativo', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.name,
          r.crmv,
          r.phone || '—',
          r.isResponsible ? 'Sim' : 'Não',
          r.isActive ? 'Sim' : 'Não',
          <RowActions
            key={r.id}
            onView={() => {
              setSelected(r);
              setViewOpen(true);
            }}
            onEdit={() => openForm('edit', r)}
            onInactivate={r.isActive ? () => void inactivate(r) : undefined}
            onDelete={() => void remove(r)}
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
        title={modal === 'edit' ? 'Alterar veterinário' : 'Incluir veterinário'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="vet-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="vet-form" onSubmit={save} key={selected?.id ?? 'new'}>
          <Field label="Nome">
            <input name="name" className={inputClass} required defaultValue={selected?.name ?? ''} />
          </Field>
          <Field label="CRMV">
            <input name="crmv" className={inputClass} required defaultValue={selected?.crmv ?? ''} />
          </Field>
          <Field label="Telefone">
            <input name="phone" type="tel" className={inputClass} defaultValue={selected?.phone ?? ''} />
          </Field>
          <Field label="E-mail">
            <input name="email" type="email" className={inputClass} defaultValue={selected?.email ?? ''} />
          </Field>
          <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="isResponsible"
              value="1"
              defaultChecked={selected?.isResponsible ?? !hasResponsible}
            />
            Responsável técnico da ficha de manejo
          </label>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar veterinário"
        sections={
          selected
            ? [
                {
                  title: 'Dados',
                  fields: [
                    { label: 'Nome', value: selected.name },
                    { label: 'CRMV', value: selected.crmv },
                    { label: 'Telefone', value: selected.phone || '—' },
                    { label: 'E-mail', value: selected.email || '—' },
                    { label: 'Responsável técnico', value: selected.isResponsible ? 'Sim' : 'Não' },
                    { label: 'Ativo', value: selected.isActive ? 'Sim' : 'Não' },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal
        open={reportsOpen}
        title="Veterinários"
        onClose={() => setReportsOpen(false)}
        compactLauncher
      />
    </AdminShell>
  );
}
