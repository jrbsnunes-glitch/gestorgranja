'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro, RecordViewModal, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type FiscalSituation = {
  id: string;
  code: string;
  description: string;
  ncm: string | null;
  cest: string | null;
  fiscalCst: string | null;
  ibsCst: string | null;
  ibsClassTrib: string | null;
  isActive: boolean;
};

export default function SituacaoFiscalPage() {
  const [rows, setRows] = useState<FiscalSituation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<FiscalSituation | null>(null);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [r.code, r.description, r.ncm ?? '', r.fiscalCst ?? ''],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<FiscalSituation[]>('/v1/cadastros/general/fiscal-situations').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: FiscalSituation) {
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
      ncm: String(fd.get('ncm') || '').trim() || null,
      cest: String(fd.get('cest') || '').trim() || null,
      fiscalCst: String(fd.get('fiscalCst') || '').trim() || null,
      ibsCst: String(fd.get('ibsCst') || '').trim() || null,
      ibsClassTrib: String(fd.get('ibsClassTrib') || '').trim() || null,
      isActive: fd.get('isActive') === 'on',
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/general/fiscal-situations/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/v1/cadastros/general/fiscal-situations', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Situação fiscal">
      <PageIntro
        title="Situação fiscal"
        description="NCM, CST/CSOSN, IBS/CBS e CEST vinculados aos produtos. No cadastro do produto escolha apenas a situação; origem e GTIN ficam no produto."
      />
      <ErrorBox message={error} />
      <ListToolbar list={list} onInclude={() => openForm('include')} searchPlaceholder="Código, NCM, CST…" />
      <PaginatedTable
        headers={['Código', 'Descrição', 'NCM', 'CST', 'IBS CST', 'cClassTrib', 'Ativo', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.code,
          r.description,
          r.ncm ?? '—',
          r.fiscalCst ?? '—',
          r.ibsCst ?? '—',
          r.ibsClassTrib ?? '—',
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
        title={modal === 'edit' ? 'Alterar situação fiscal' : 'Incluir situação fiscal'}
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="fiscal-sit-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="fiscal-sit-form" onSubmit={save} key={selected?.id ?? 'new'} className="grid gap-3 sm:grid-cols-2">
          <Field label="Código">
            <input name="code" className={inputClass} required defaultValue={selected?.code} />
          </Field>
          <Field label="Descrição">
            <input name="description" className={inputClass} required defaultValue={selected?.description} />
          </Field>
          <Field label="NCM">
            <input name="ncm" className={inputClass} defaultValue={selected?.ncm ?? ''} placeholder="04072100" />
          </Field>
          <Field label="CEST">
            <input name="cest" className={inputClass} defaultValue={selected?.cest ?? ''} />
          </Field>
          <Field label="CSOSN/CST (ICMS)">
            <input name="fiscalCst" className={inputClass} defaultValue={selected?.fiscalCst ?? ''} placeholder="102" />
          </Field>
          <Field label="CST IBS/CBS">
            <input name="ibsCst" className={inputClass} defaultValue={selected?.ibsCst ?? ''} placeholder="200" />
          </Field>
          <Field label="cClassTrib (IBS/CBS)">
            <input
              name="ibsClassTrib"
              className={inputClass}
              defaultValue={selected?.ibsClassTrib ?? ''}
              placeholder="200022"
            />
          </Field>
          {modal === 'edit' ? (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name="isActive" defaultChecked={selected?.isActive ?? true} />
              Ativo
            </label>
          ) : null}
          <p className="text-xs text-slate-500 sm:col-span-2">
            Valide NCM, CST e cClassTrib com o contador (NT 2025.002 — reforma tributária).
          </p>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar situação fiscal"
        sections={
          selected
            ? [
                {
                  title: 'Dados fiscais',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Descrição', value: selected.description },
                    { label: 'NCM', value: selected.ncm ?? '—' },
                    { label: 'CEST', value: selected.cest ?? '—' },
                    { label: 'CSOSN/CST (ICMS)', value: selected.fiscalCst ?? '—' },
                    { label: 'CST IBS/CBS', value: selected.ibsCst ?? '—' },
                    { label: 'cClassTrib', value: selected.ibsClassTrib ?? '—' },
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
