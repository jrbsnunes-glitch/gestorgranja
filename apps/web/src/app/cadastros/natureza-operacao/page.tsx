'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro, RecordViewModal, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type OperationNature = {
  id: string;
  code: string;
  description: string;
  cfopInternal: string;
  cfopExternal: string;
  isActive: boolean;
};

export default function NaturezaOperacaoPage() {
  const [rows, setRows] = useState<OperationNature[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<OperationNature | null>(null);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [r.code, r.description, r.cfopInternal, r.cfopExternal],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<OperationNature[]>('/v1/cadastros/general/operation-natures').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: OperationNature) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      code: fd.get('code'),
      description: fd.get('description'),
      cfopInternal: fd.get('cfopInternal'),
      cfopExternal: fd.get('cfopExternal'),
      isActive: fd.get('isActive') === 'on',
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/general/operation-natures/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/v1/cadastros/general/operation-natures', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Natureza da operação">
      <PageIntro
        title="Natureza da operação"
        description="CFOP e descrição usados na NF-e por item. O produto não carrega mais CFOP — escolha a natureza ao emitir a nota."
      />
      <ErrorBox message={error} />
      <ListToolbar list={list} onInclude={() => openForm('include')} searchPlaceholder="Código, descrição, CFOP…" />
      <PaginatedTable
        headers={['Código', 'Descrição', 'CFOP interno', 'CFOP externo', 'Ativo', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.code,
          r.description,
          r.cfopInternal,
          r.cfopExternal,
          r.isActive ? 'Sim' : 'Não',
          <RowActions
            key={r.id}
            onView={() => {
              setSelected(r);
              setViewOpen(true);
            }}
            onEdit={() => openForm('edit', r)}
          />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <FormCadastroModal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Alterar natureza' : 'Incluir natureza'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="natureza-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="natureza-form" onSubmit={save} key={selected?.id ?? 'new'}>
          <Field label="Código">
            <input name="code" className={inputClass} required defaultValue={selected?.code} placeholder="VENDA-5102" />
          </Field>
          <Field label="Descrição">
            <input name="description" className={inputClass} required defaultValue={selected?.description} />
          </Field>
          <Field label="CFOP venda (dentro UF)">
            <input
              name="cfopInternal"
              className={inputClass}
              required
              maxLength={4}
              defaultValue={selected?.cfopInternal ?? '5102'}
            />
          </Field>
          <Field label="CFOP venda (fora UF)">
            <input
              name="cfopExternal"
              className={inputClass}
              required
              maxLength={4}
              defaultValue={selected?.cfopExternal ?? '6102'}
            />
          </Field>
          {modal === 'edit' ? (
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="isActive" defaultChecked={selected?.isActive ?? true} />
              Ativo
            </label>
          ) : null}
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar natureza da operação"
        sections={
          selected
            ? [
                {
                  title: 'Dados',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Descrição', value: selected.description },
                    { label: 'CFOP interno (dentro UF)', value: selected.cfopInternal },
                    { label: 'CFOP externo (fora UF)', value: selected.cfopExternal },
                    { label: 'Ativo', value: selected.isActive ? 'Sim' : 'Não' },
                  ],
                },
              ]
            : []
        }
      />
    </AdminShell>
  );
}
