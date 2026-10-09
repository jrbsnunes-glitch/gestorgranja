'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
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
import { FlockMovementsModal, type FlockBalance } from '@/components/operation/flock-movements-modal';
import { LotViewPanel } from '@/components/operation/lot-view-panel';
import {
  BarnLookupField,
  BreedLineageLookupField,
  type BarnOption,
  type LineageOption,
} from '@/components/flock-barn-lineage-lookup';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { flockAgeWeeks } from '@/lib/flock-age';
import { labelEnum } from '@/lib/labels';

type Barn = BarnOption;
type Lineage = LineageOption;
type Lot = {
  id: string;
  controlNumber?: number;
  code: string;
  housedQty: number;
  mortalityTotal: number;
  liveBirds: number;
  balance?: FlockBalance;
  housingDate: string;
  initialAgeWeeks?: number;
  status: string;
  eggType: string | null;
  strainNotes: string | null;
  supplierBatch: string | null;
  expectedEndDate: string | null;
  plantNotes: string | null;
  barn: Barn;
  breedLineage: Lineage;
};

function LotFicha({
  lot,
  dash,
  onClose,
}: {
  lot: Lot | null;
  dash: LotDash | null;
  onClose: () => void;
}) {
  if (!lot) {
    return <p className="mb-4 text-sm text-slate-500">Carregando ficha do lote…</p>;
  }
  const live = lot.liveBirds ?? lot.housedQty;
  const nf = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('pt-BR'));
  const pf = (n: number | null | undefined) => (n == null ? '—' : `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
  return (
    <section className="mb-4 rounded-xl border border-emerald-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/producao/galinha.svg" alt="" className="h-12 w-12" />
          <div>
            <h2 className="text-lg font-semibold text-emerald-950">{lot.code}</h2>
            <p className="text-sm text-slate-600">
              {lot.barn.name} · {lot.breedLineage.name} · chegada {new Date(lot.housingDate).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        <button type="button" className="text-sm text-slate-500 hover:underline" onClick={onClose}>
          Fechar
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <FichaStat
          label="Idade atual"
          value={`${flockAgeWeeks(lot.housingDate, lot.initialAgeWeeks ?? 0)} semanas`}
          hint={
            (lot.initialAgeWeeks ?? 0) > 0
              ? `inicial ${lot.initialAgeWeeks} sem. no alojamento`
              : undefined
          }
        />
        <FichaStat label="Aves vivas" value={nf(live)} hint={`alojadas ${nf(lot.housedQty)}`} />
        <FichaStat label="Mortalidade acum." value={nf(lot.mortalityTotal)} />
        <FichaStat label="Postura (7 dias)" value={pf(dash?.totals.layRatePct)} />
        <FichaStat label="Ovos comerciais (7 dias)" value={nf(dash?.totals.commercial)} />
        <FichaStat label="Produzidos (7 dias)" value={nf(dash?.totals.produced)} />
        <FichaStat label="Mortes no período" value={nf(dash?.totals.mortality)} />
        <FichaStat label="Status" value={labelEnum(lot.status)} />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <Link href="/producao" className="text-emerald-800 underline">
          Registrar produção
        </Link>
        <Link href="/producao?tab=mortalidade" className="text-emerald-800 underline">
          Registrar mortalidade
        </Link>
      </div>
    </section>
  );
}

function FichaStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg bg-emerald-50/70 px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

type LotDash = {
  totals: {
    commercial: number;
    produced: number;
    layRatePct: number | null;
    mortality: number;
    liveBirds: number;
  };
};

export default function LotesPage() {
  const searchParams = useSearchParams();
  const [lots, setLots] = useState<Lot[]>([]);
  const [barns, setBarns] = useState<Barn[]>([]);
  const [lineages, setLineages] = useState<Lineage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [movementsOpen, setMovementsOpen] = useState(false);
  const [selected, setSelected] = useState<Lot | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(searchParams.get('lote'));
  const [fichaDash, setFichaDash] = useState<LotDash | null>(null);
  const [formBarnId, setFormBarnId] = useState('');
  const [formLineageId, setFormLineageId] = useState('');

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

  useEffect(() => {
    const id = searchParams.get('lote');
    if (id) setFichaId(id);
  }, [searchParams]);

  useEffect(() => {
    if (!fichaId) {
      setFichaDash(null);
      return;
    }
    const to = new Date().toISOString().slice(0, 10);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 6);
    const from = fromDate.toISOString().slice(0, 10);
    void apiFetch<LotDash>(`/v1/operation/dashboard?from=${from}&to=${to}&flockLotId=${fichaId}`)
      .then(setFichaDash)
      .catch(() => setFichaDash(null));
  }, [fichaId]);

  function openForm(mode: 'include' | 'edit', row?: Lot) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
    setFormBarnId(row?.barn.id ?? '');
    setFormLineageId(row?.breedLineage.id ?? '');
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
            code: fd.get('code'),
            barnId: fd.get('barnId'),
            breedLineageId: fd.get('breedLineageId'),
            housingDate: fd.get('housingDate'),
            housedQty: Number(fd.get('housedQty')),
            status: fd.get('status'),
            eggType: fd.get('eggType') || null,
            strainNotes: fd.get('strainNotes') || null,
            supplierBatch: fd.get('supplierBatch') || null,
            expectedEndDate: fd.get('expectedEndDate') || null,
            plantNotes: fd.get('plantNotes') || null,
            initialAgeWeeks: Number(fd.get('initialAgeWeeks') || 0),
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
            initialAgeWeeks: Number(fd.get('initialAgeWeeks') || 0),
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
    <span key={l.id} className="flex flex-wrap items-center gap-1.5 max-sm:w-full max-sm:justify-end">
      <RowActions
        onView={() => {
          setSelected(l);
          setViewOpen(true);
        }}
        onEdit={() => openForm('edit', l)}
      />
      <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setFichaId(l.id)}>
        Ficha
      </Button>
      <Button
        type="button"
        variant="secondary"
        className="px-2 py-1 text-xs"
        onClick={() => {
          setSelected(l);
          setMovementsOpen(true);
        }}
      >
        Movimentações
      </Button>
    </span>,
  ]);

  return (
    <AdminShell title="Lotes / plantel">
      <PageIntro
        title="Lotes / plantel"
        description="Cadastro de lotes avícolas, alojamento, linhagem e acompanhamento do plantel."
      />
      <ErrorBox message={error} />
      {fichaId ? (
        <LotFicha
          lot={lots.find((l) => l.id === fichaId) ?? null}
          dash={fichaDash}
          onClose={() => setFichaId(null)}
        />
      ) : null}
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
        {modal === 'include' || (modal === 'edit' && selected) ? (
          <form
            id="lot-form"
            onSubmit={save}
            key={modal === 'edit' && selected ? selected.id : 'new'}
            className="grid gap-0 md:grid-cols-2 md:gap-x-4"
          >
            {modal === 'edit' && selected?.controlNumber != null ? (
              <Field label="Controle">
                <input
                  className={inputClass}
                  readOnly
                  disabled
                  value={String(selected.controlNumber)}
                  aria-readonly
                />
              </Field>
            ) : null}
            <Field label="Código do lote">
              <input
                name="code"
                className={inputClass}
                required
                placeholder="L2026-01"
                defaultValue={modal === 'edit' && selected ? selected.code : undefined}
              />
            </Field>
            <Field label="Data de alojamento">
              <input
                name="housingDate"
                type="date"
                className={inputClass}
                required
                defaultValue={
                  modal === 'edit' && selected ? selected.housingDate.slice(0, 10) : undefined
                }
              />
            </Field>
            <BarnLookupField
              barns={barns}
              barnId={formBarnId}
              onBarnIdChange={setFormBarnId}
              onBarnCreated={(barn) => setBarns((prev) => [...prev, barn].sort((a, b) => a.code.localeCompare(b.code)))}
            />
            <BreedLineageLookupField
              lineages={lineages}
              lineageId={formLineageId}
              onLineageIdChange={setFormLineageId}
              onLineageCreated={(lineage) =>
                setLineages((prev) => [...prev, lineage].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
              }
            />
            <Field label="Aves alojadas">
              <input
                name="housedQty"
                type="number"
                className={inputClass}
                required
                min={1}
                defaultValue={modal === 'edit' && selected ? selected.housedQty : undefined}
              />
            </Field>
            {modal === 'edit' && selected ? (
              <>
                <Field label="Mortalidade (calculada)">
                  <input
                    className={inputClass}
                    readOnly
                    disabled
                    value={String(selected.mortalityTotal ?? 0)}
                    aria-readonly
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Registros diários de mortalidade na operação.</p>
                </Field>
                <Field label="Aves vivas (calculadas)">
                  <input
                    className={inputClass}
                    readOnly
                    disabled
                    value={String(selected.liveBirds ?? selected.housedQty)}
                    aria-readonly
                  />
                  <p className="mt-1 text-[11px] text-slate-500">Saldo com movimentações e mortalidade.</p>
                </Field>
                <Field label="Status">
                  <select name="status" className={inputClass} required defaultValue={selected.status}>
                    <option value="ACTIVE">{labelEnum('ACTIVE')}</option>
                    <option value="FINISHED">{labelEnum('FINISHED')}</option>
                  </select>
                </Field>
              </>
            ) : null}
            <Field label="Idade inicial (semanas)">
              <input
                name="initialAgeWeeks"
                type="number"
                className={inputClass}
                min={0}
                step={1}
                defaultValue={modal === 'edit' && selected ? (selected.initialAgeWeeks ?? 0) : 0}
                placeholder="Ex.: 15"
              />
              <p className="mt-1 text-[11px] text-slate-500 md:col-span-2">
                Idade das aves no dia do alojamento (recria). Usada na curva zootécnica e no painel.
              </p>
            </Field>
            {modal === 'edit' && selected ? (
              <>
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
                <label className="mb-3 block text-sm md:col-span-2">
                  <span className="mb-1 block text-slate-600">Observações do plantel</span>
                  <textarea
                    name="plantNotes"
                    className={inputClass}
                    rows={2}
                    defaultValue={selected.plantNotes ?? ''}
                  />
                </label>
              </>
            ) : null}
          </form>
        ) : null}
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar lote"
        wide
        compact
      >
        {selected ? <LotViewPanel lot={selected} /> : null}
      </RecordViewModal>

      <FlockMovementsModal
        open={movementsOpen}
        onClose={() => setMovementsOpen(false)}
        lot={selected ? { id: selected.id, code: selected.code, status: selected.status } : null}
        lots={lots.map((l) => ({ id: l.id, code: l.code }))}
        onChanged={load}
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
