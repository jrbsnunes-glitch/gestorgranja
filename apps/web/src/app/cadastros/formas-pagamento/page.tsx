'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';

type PaymentForm = {
  id: string;
  controlNumber: number;
  name: string;
  kind: string;
  colorHex: string;
  sortOrder: number;
  isActive: boolean;
};

const KINDS = ['CASH', 'PIX', 'CARD', 'TRANSFER', 'BOLETO', 'OTHER'] as const;

export default function FormasPagamentoPage() {
  const [rows, setRows] = useState<PaymentForm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<PaymentForm | null>(null);

  const list = useCrudList({ items: rows, searchFields: (r) => [r.name, r.kind] });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<PaymentForm[]>('/v1/cadastros/payment-forms').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: PaymentForm) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get('name'),
      kind: fd.get('kind'),
      colorHex: fd.get('colorHex'),
      sortOrder: Number(fd.get('sortOrder') ?? 50),
      isActive: fd.get('isActive') === 'on',
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/payment-forms/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/v1/cadastros/payment-forms', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Formas de pagamento">
      <PageIntro
        title="Formas de pagamento"
        description="Opções do PDV. Tipo boleto não entra no caixa: gera conta a receber e registro Sicoob."
      />
      <ErrorBox message={error} />
      <ListToolbar list={list} onInclude={() => openForm('include')} searchPlaceholder="Nome, tipo…" />
      <PaginatedTable
        headers={['Nome', 'Tipo caixa', 'Cor', 'Ordem', 'Ativa', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.name,
          labelEnum(r.kind),
          <span key={r.id} className="inline-flex items-center gap-2">
            <span className="h-4 w-4 rounded border border-slate-200" style={{ background: r.colorHex }} />
            {r.colorHex}
          </span>,
          String(r.sortOrder),
          r.isActive ? 'Sim' : 'Não',
          <RowActions key={r.id} onView={() => openForm('edit', r)} onEdit={() => openForm('edit', r)} />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <FormCadastroModal
        open={modal === 'include' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Alterar forma de pagamento' : 'Incluir forma de pagamento'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="payment-form-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="payment-form-form" onSubmit={save}>
          <Field label="Nome (ex.: Dinheiro, PIX débito)">
            <input name="name" className={inputClass} required defaultValue={selected?.name ?? ''} />
          </Field>
          <Field label="Tipo para o caixa">
            <select name="kind" className={inputClass} defaultValue={selected?.kind ?? 'CASH'}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {labelEnum(k)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cor (PDV)">
            <input name="colorHex" type="color" className="h-10 w-full" defaultValue={selected?.colorHex ?? '#0f766e'} />
          </Field>
          <Field label="Ordem de exibição">
            <input name="sortOrder" type="number" className={inputClass} defaultValue={selected?.sortOrder ?? 50} />
          </Field>
          {modal === 'edit' ? (
            <label className="flex items-center gap-2 text-sm">
              <input name="isActive" type="checkbox" defaultChecked={selected?.isActive ?? true} />
              Ativa no PDV
            </label>
          ) : null}
        </form>
      </FormCadastroModal>
    </AdminShell>
  );
}
