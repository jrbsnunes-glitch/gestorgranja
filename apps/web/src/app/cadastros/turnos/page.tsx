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

type WorkShift = {
  id: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  isActive: boolean;
};

export default function TurnosPage() {
  const [rows, setRows] = useState<WorkShift[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<WorkShift | null>(null);

  const list = useCrudList({ items: rows, searchFields: (r) => [r.code, r.name] });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<WorkShift[]>('/v1/cadastros/work-shifts').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: WorkShift) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      code: fd.get('code'),
      name: fd.get('name'),
      startTime: fd.get('startTime'),
      endTime: fd.get('endTime'),
      breakMinutes: Number(fd.get('breakMinutes') || 60),
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/work-shifts/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/cadastros/work-shifts', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function inactivate(row: WorkShift) {
    await apiFetch(`/v1/cadastros/work-shifts/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    load();
  }

  async function remove(row: WorkShift) {
    if (!confirm(`Excluir turno ${row.code}?`)) return;
    try {
      await apiFetch(`/v1/cadastros/work-shifts/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Turnos de trabalho">
      <PageIntro title="Turnos de trabalho" description="Horários de entrada, saída e intervalo para a folha e operação." />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => openForm('include')}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Código ou nome…"
      />
      <PaginatedTable
        headers={['Código', 'Nome', 'Entrada', 'Saída', 'Intervalo (min)', 'Ativo', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.code,
          r.name,
          r.startTime,
          r.endTime,
          String(r.breakMinutes),
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
        title={modal === 'edit' ? 'Alterar turno' : 'Incluir turno'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="shift-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="shift-form" onSubmit={save} key={selected?.id ?? 'new'}>
          <Field label="Código">
            <input name="code" className={inputClass} required defaultValue={selected?.code ?? ''} />
          </Field>
          <Field label="Nome">
            <input name="name" className={inputClass} required defaultValue={selected?.name ?? ''} />
          </Field>
          <Field label="Entrada">
            <input
              name="startTime"
              type="time"
              className={inputClass}
              required
              defaultValue={selected?.startTime ?? '08:00'}
            />
          </Field>
          <Field label="Saída">
            <input
              name="endTime"
              type="time"
              className={inputClass}
              required
              defaultValue={selected?.endTime ?? '17:00'}
            />
          </Field>
          <Field label="Intervalo (min)">
            <input name="breakMinutes" type="number" className={inputClass} defaultValue={selected?.breakMinutes ?? 60} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar turno"
        sections={
          selected
            ? [
                {
                  title: 'Dados',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Nome', value: selected.name },
                    { label: 'Entrada', value: selected.startTime },
                    { label: 'Saída', value: selected.endTime },
                    { label: 'Intervalo', value: `${selected.breakMinutes} min` },
                    { label: 'Ativo', value: selected.isActive ? 'Sim' : 'Não' },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal open={reportsOpen} title="Turnos" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
