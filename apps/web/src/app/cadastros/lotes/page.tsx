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
import { labelEnum } from '@/lib/labels';

type Barn = { id: string; code: string; name: string };
type Lineage = { id: string; code: string; name: string };
type Lot = {
  id: string;
  code: string;
  housedQty: number;
  mortalityTotal: number;
  liveBirds: number;
  housingDate: string;
  status: string;
  eggType: string | null;
  strainNotes: string | null;
  supplierBatch: string | null;
  expectedEndDate: string | null;
  plantNotes: string | null;
  barn: Barn;
  breedLineage: Lineage;
};

export default function LotesPage() {
  const [lots, setLots] = useState<Lot[]>([]);
  const [barns, setBarns] = useState<Barn[]>([]);
  const [lineages, setLineages] = useState<Lineage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Lot | null>(null);

  const list = useCrudList({
    items: lots,
    searchFields: (l) => [l.code, l.barn.name, l.barn.code, l.breedLineage.name, l.status, l.supplierBatch],
    dateField: (l) => l.housingDate,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Lot[]>('/v1/production/lots').then(setLots);
    void apiFetch<Barn[]>('/v1/cadastros/barns').then(setBarns);
    void apiFetch<Lineage[]>('/v1/cadastros/breed-lineages').then(setLineages);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: Lot) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/cadastros/flock-lots/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            eggType: fd.get('eggType') || undefined,
            strainNotes: fd.get('strainNotes') || undefined,
            supplierBatch: fd.get('supplierBatch') || undefined,
            expectedEndDate: fd.get('expectedEndDate') || undefined,
            plantNotes: fd.get('plantNotes') || undefined,
          }),
        });
      } else {
        await apiFetch('/v1/cadastros/flock-lots', {
          method: 'POST',
          body: JSON.stringify({
            code: fd.get('code'),
            barnId: fd.get('barnId'),
            breedLineageId: fd.get('breedLineageId'),
            housingDate: fd.get('housingDate'),
            housedQty: Number(fd.get('housedQty')),
          }),
        });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  const tableRows = slice.map((l) => [
    l.code,
    l.barn.name,
    l.breedLineage.name,
    new Date(l.housingDate).toLocaleDateString('pt-BR'),
    String(l.housedQty),
    String(l.mortalityTotal ?? 0),
    String(l.liveBirds ?? l.housedQty),
    labelEnum(l.status),
    <RowActions
      key={l.id}
      onView={() => {
        setSelected(l);
        setViewOpen(true);
      }}
      onEdit={() => openForm('edit', l)}
    />,
  ]);

  return (
    <AdminShell title="Lotes / plantel">
      <PageIntro
        title="Lotes / plantel"
        description="Cadastro de lotes avícolas, alojamento, linhagem e acompanhamento do plantel."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => openForm('include')}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Código, galpão, linhagem…"
        showDateFilter
      />
      <PaginatedTable
        headers={[
          'Código',
          'Galpão',
          'Linhagem',
          'Alojamento',
          'Aves aloj.',
          'Mortalidade',
          'Aves vivas',
          'Status',
          'Ações',
        ]}
        recordItems={slice}
        rows={tableRows}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <FormCadastroModal
        open={modal === 'include' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Alterar plantel' : 'Incluir lote'}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="lot-form">
              Salvar
            </Button>
          </>
        }
      >
        {modal === 'edit' && selected ? (
          <form id="lot-form" onSubmit={save} key={selected.id} className="grid gap-0 md:grid-cols-2 md:gap-x-4">
            <Field label="Tipo de ovo (casca)">
              <select name="eggType" className={inputClass} defaultValue={selected.eggType ?? ''}>
                <option value="">—</option>
                <option value="WHITE">Branco</option>
                <option value="BROWN">Vermelho</option>
                <option value="MIXED">Misto</option>
              </select>
            </Field>
            <Field label="Lote do fornecedor">
              <input name="supplierBatch" className={inputClass} defaultValue={selected.supplierBatch ?? ''} />
            </Field>
            <Field label="Previsão fim de ciclo">
              <input
                name="expectedEndDate"
                type="date"
                className={inputClass}
                defaultValue={selected.expectedEndDate ? selected.expectedEndDate.slice(0, 10) : ''}
              />
            </Field>
            <Field label="Notas da linhagem">
              <input name="strainNotes" className={inputClass} defaultValue={selected.strainNotes ?? ''} />
            </Field>
            <Field label="Observações do plantel">
              <input name="plantNotes" className={inputClass} defaultValue={selected.plantNotes ?? ''} />
            </Field>
          </form>
        ) : modal === 'include' ? (
          <form id="lot-form" onSubmit={save} key="new" className="grid gap-0 md:grid-cols-2 md:gap-x-4">
            <Field label="Código do lote">
              <input name="code" className={inputClass} required placeholder="L2026-01" />
            </Field>
            <Field label="Data de alojamento">
              <input name="housingDate" type="date" className={inputClass} required />
            </Field>
            <Field label="Galpão">
              <select name="barnId" className={inputClass} required>
                <option value="">Selecione</option>
                {barns.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Linhagem">
              <select name="breedLineageId" className={inputClass} required>
                <option value="">Selecione</option>
                {lineages.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Aves alojadas">
              <input name="housedQty" type="number" className={inputClass} required min={1} />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar lote"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Identificação',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Galpão', value: selected.barn.name },
                    { label: 'Linhagem', value: selected.breedLineage.name },
                    { label: 'Status', value: labelEnum(selected.status) },
                  ],
                },
                {
                  title: 'Alojamento e plantel',
                  fields: [
                    { label: 'Data de alojamento', value: new Date(selected.housingDate).toLocaleDateString('pt-BR') },
                    { label: 'Aves alojadas', value: selected.housedQty },
                    { label: 'Mortalidade acumulada', value: selected.mortalityTotal ?? 0 },
                    { label: 'Aves vivas (estim.)', value: selected.liveBirds ?? selected.housedQty },
                    { label: 'Tipo de ovo', value: labelEnum(selected.eggType) },
                    { label: 'Lote fornecedor', value: selected.supplierBatch ?? '—' },
                    {
                      label: 'Previsão encerramento',
                      value: selected.expectedEndDate
                        ? new Date(selected.expectedEndDate).toLocaleDateString('pt-BR')
                        : '—',
                    },
                    { label: 'Notas da linhagem', value: selected.strainNotes ?? '—' },
                    { label: 'Observações do plantel', value: selected.plantNotes ?? '—' },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal
        open={reportsOpen}
        title="Lotes / plantel"
        onClose={() => setReportsOpen(false)}
        compactLauncher
      />
    </AdminShell>
  );
}
