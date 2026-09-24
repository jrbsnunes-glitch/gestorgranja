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

type ChartAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  isActive: boolean;
  isPosting: boolean;
};

const TYPES = [
  { value: 'ASSET', label: 'Ativo' },
  { value: 'LIABILITY', label: 'Passivo' },
  { value: 'EQUITY', label: 'Patrimônio líquido' },
  { value: 'REVENUE', label: 'Receita' },
  { value: 'EXPENSE', label: 'Despesa' },
];

function typeLabel(type: string) {
  return TYPES.find((t) => t.value === type)?.label ?? type;
}

export default function PlanoContasPage() {
  const [rows, setRows] = useState<ChartAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<ChartAccount | null>(null);

  const list = useCrudList({ items: rows, searchFields: (r) => [r.code, r.name, r.type] });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<ChartAccount[]>('/v1/cadastros/chart-accounts').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: ChartAccount) {
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
      type: fd.get('type'),
      parentId: fd.get('parentId') || undefined,
      isPosting: fd.get('isPosting') === 'on',
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/chart-accounts/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/cadastros/chart-accounts', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function inactivate(row: ChartAccount) {
    await apiFetch(`/v1/cadastros/chart-accounts/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    load();
  }

  async function remove(row: ChartAccount) {
    if (!confirm(`Excluir conta ${row.code}?`)) return;
    try {
      await apiFetch(`/v1/cadastros/chart-accounts/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  function parentLabel(parentId: string | null) {
    if (!parentId) return '—';
    const p = rows.find((r) => r.id === parentId);
    return p ? `${p.code} — ${p.name}` : parentId;
  }

  return (
    <AdminShell title="Plano de contas">
      <PageIntro
        title="Plano de contas"
        description="Plano padrão (estrutura 1–7, referência RFB / GestorVend) com contas para avicultura: estoques de ração e ovos, custos de produção, folha, impostos, vendas e despesas. Novos tenants recebem o cadastro automaticamente; você pode incluir ou ajustar contas analíticas conforme a contabilidade da granja."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => openForm('include')}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Código, nome ou tipo…"
      />
      <PaginatedTable
        headers={['Código', 'Nome', 'Tipo', 'Analítica', 'Ativa', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.code,
          r.name,
          typeLabel(r.type),
          r.isPosting ? 'Sim' : 'Não',
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
        title={modal === 'edit' ? 'Alterar conta' : 'Incluir conta'}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="chart-account-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="chart-account-form" onSubmit={save} key={selected?.id ?? 'new'}>
          <Field label="Código">
            <input name="code" className={inputClass} required defaultValue={selected?.code ?? ''} />
          </Field>
          <Field label="Nome">
            <input name="name" className={inputClass} required defaultValue={selected?.name ?? ''} />
          </Field>
          <Field label="Tipo">
            <select name="type" className={inputClass} defaultValue={selected?.type ?? 'EXPENSE'}>
              {TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Conta pai (id)">
            <select name="parentId" className={inputClass} defaultValue={selected?.parentId ?? ''}>
              <option value="">— Raiz —</option>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="mb-4 flex items-center gap-2 text-sm">
            <input name="isPosting" type="checkbox" defaultChecked={selected?.isPosting ?? true} />
            Conta analítica (aceita lançamentos)
          </label>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar conta"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Dados',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Nome', value: selected.name },
                    { label: 'Tipo', value: typeLabel(selected.type) },
                    { label: 'Conta pai', value: parentLabel(selected.parentId) },
                    { label: 'Analítica', value: selected.isPosting ? 'Sim' : 'Não' },
                    { label: 'Ativa', value: selected.isActive ? 'Sim' : 'Não' },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal open={reportsOpen} title="Plano de contas" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
