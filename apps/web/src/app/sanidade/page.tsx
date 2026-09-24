'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import {
  ListToolbar,
  PaginatedTable,
  RowActions,
  TabBar,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type Lot = { id: string; code: string; barn: { name: string } };

type HealthEvent = {
  id: string;
  type: string;
  productName: string;
  appliedAt: string;
  withdrawalDays: number;
  flockLot: { code: string };
};

type BioLog = {
  id: string;
  visitedAt: string;
  visitorName: string;
  vehiclePlate: string | null;
  purpose: string | null;
  epiUsed: boolean;
};

type SanitaryProduct = { id: string; name: string; withdrawalDaysDefault: number };

type TabId = 'eventos' | 'bio';

function healthTypeLabel(type: string) {
  return type === 'VACCINE' ? 'Vacina' : type === 'MEDICATION' ? 'Medicamento' : type;
}

export default function SanidadePage() {
  const [tab, setTab] = useState<TabId>('eventos');
  const [lots, setLots] = useState<Lot[]>([]);
  const [events, setEvents] = useState<HealthEvent[]>([]);
  const [bio, setBio] = useState<BioLog[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [productModal, setProductModal] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [viewEvent, setViewEvent] = useState<HealthEvent | null>(null);
  const [viewBio, setViewBio] = useState<BioLog | null>(null);
  const [lotId, setLotId] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState<SanitaryProduct[]>([]);
  const [productName, setProductName] = useState('');
  const [withdrawalDays, setWithdrawalDays] = useState(0);

  const eventList = useCrudList({
    items: events,
    searchFields: (ev) => [ev.flockLot.code, ev.type, ev.productName],
    dateField: (ev) => ev.appliedAt,
  });
  const bioList = useCrudList({
    items: bio,
    searchFields: (b) => [b.visitorName, b.vehiclePlate, b.purpose],
    dateField: (b) => b.visitedAt,
  });

  const evPag = usePagination(eventList.filtered);
  const bioPag = usePagination(bioList.filtered);

  const activeList = useMemo(() => (tab === 'eventos' ? eventList : bioList), [tab, eventList, bioList]);

  const load = useCallback(() => {
    void apiFetch<HealthEvent[]>('/v1/health/events').then(setEvents);
    void apiFetch<BioLog[]>('/v1/health/biosecurity').then(setBio);
  }, []);

  useEffect(() => {
    void apiFetch<Lot[]>('/v1/production/lots').then((rows) => {
      setLots(rows);
      if (rows[0]) setLotId(rows[0].id);
    });
    load();
  }, [load]);

  useEffect(() => {
    const q = productQuery.trim();
    if (q.length < 2) {
      setProductOptions([]);
      return;
    }
    const t = window.setTimeout(() => {
      void apiFetch<SanitaryProduct[]>(`/v1/health/sanitary-products?q=${encodeURIComponent(q)}`).then(
        setProductOptions,
      );
    }, 300);
    return () => window.clearTimeout(t);
  }, [productQuery]);

  function pickProduct(p: SanitaryProduct) {
    setProductName(p.name);
    setProductQuery(p.name);
    setWithdrawalDays(p.withdrawalDaysDefault);
    setProductOptions([]);
  }

  async function createSanitaryProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiFetch<SanitaryProduct>('/v1/health/sanitary-products', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          brand: fd.get('brand') || undefined,
          activeIngredient: fd.get('activeIngredient') || undefined,
          withdrawalDaysDefault: Number(fd.get('withdrawalDaysDefault') ?? 0),
        }),
      });
      pickProduct(created);
      setProductModal(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const name = productName.trim() || String(fd.get('productName') || '').trim();
    if (!name) {
      setError('Selecione ou informe o produto sanitário');
      return;
    }
    try {
      await apiFetch('/v1/health/events', {
        method: 'POST',
        body: JSON.stringify({
          flockLotId: lotId,
          type: fd.get('type'),
          productName: name,
          appliedAt: fd.get('appliedAt'),
          withdrawalDays: Number(fd.get('withdrawalDays') ?? withdrawalDays),
          notes: fd.get('notes') || undefined,
        }),
      });
      setModal(null);
      setProductName('');
      setProductQuery('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitBio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/health/biosecurity', {
        method: 'POST',
        body: JSON.stringify({
          visitedAt: fd.get('visitedAt'),
          visitorName: fd.get('visitorName'),
          vehiclePlate: fd.get('vehiclePlate') || undefined,
          purpose: fd.get('purpose') || undefined,
          epiUsed: fd.get('epiUsed') === 'on',
          notes: fd.get('notes') || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const reportsTitle = tab === 'eventos' ? 'Vacina / medicamento' : 'Entrada / visita';
  const searchPlaceholder =
    tab === 'eventos' ? 'Lote, tipo ou produto…' : 'Visitante, placa ou finalidade…';
  const includeLabel = tab === 'eventos' ? undefined : 'Incluir visita';
  const formTitle = tab === 'eventos' ? 'Incluir vacina / medicamento' : 'Incluir visita';

  return (
    <AdminShell title="Sanidade e biosseguridade">
      <PageIntro
        title="Sanidade e biosseguridade"
        description="Registro de vacinas, medicamentos, carência e controle de entradas na granja."
      />
      <ErrorBox message={error} />
      <TabBar
        active={tab}
        onChange={(id) => setTab(id as TabId)}
        tabs={[
          { id: 'eventos', label: 'Vacina / medicamento' },
          { id: 'bio', label: 'Entrada / visita' },
        ]}
      />

      <ListToolbar
        list={activeList}
        onInclude={() => setModal('include')}
        onReports={() => setReportsOpen(true)}
        label={includeLabel}
        searchPlaceholder={searchPlaceholder}
        showDateFilter
        showPrint={false}
      />

      {tab === 'eventos' ? (
        <PaginatedTable
          headers={['Lote', 'Tipo', 'Produto', 'Aplicado', 'Carência (d)', 'Ações']}
          recordItems={evPag.slice}
          rows={evPag.slice.map((ev) => [
            ev.flockLot.code,
            healthTypeLabel(ev.type),
            ev.productName,
            new Date(ev.appliedAt).toLocaleString('pt-BR'),
            String(ev.withdrawalDays),
            <RowActions
              key={ev.id}
              onView={() => {
                setViewEvent(ev);
                setViewOpen(true);
              }}
            />,
          ])}
          page={evPag.page}
          totalPages={evPag.totalPages}
          total={evPag.total}
          onPage={evPag.setPage}
        />
      ) : (
        <PaginatedTable
          headers={['Data', 'Visitante', 'Placa', 'EPI', 'Finalidade', 'Ações']}
          recordItems={bioPag.slice}
          rows={bioPag.slice.map((b) => [
            new Date(b.visitedAt).toLocaleString('pt-BR'),
            b.visitorName,
            b.vehiclePlate ?? '—',
            b.epiUsed ? 'Sim' : 'Não',
            b.purpose ?? '—',
            <RowActions
              key={b.id}
              onView={() => {
                setViewBio(b);
                setViewOpen(true);
              }}
            />,
          ])}
          page={bioPag.page}
          totalPages={bioPag.totalPages}
          total={bioPag.total}
          onPage={bioPag.setPage}
        />
      )}

      <FormCadastroModal
        open={modal === 'include'}
        onClose={() => setModal(null)}
        title={formTitle}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form={tab === 'eventos' ? 'health-event-form' : 'bio-visit-form'}>
              Registrar
            </Button>
          </>
        }
      >
        {tab === 'eventos' ? (
          <form id="health-event-form" onSubmit={submitEvent}>
            <Field label="Lote">
              <select className={inputClass} value={lotId} onChange={(e) => setLotId(e.target.value)}>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.barn.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select name="type" className={inputClass} required>
                <option value="VACCINE">Vacina</option>
                <option value="MEDICATION">Medicamento</option>
              </select>
            </Field>
            <Field label="Produto sanitário">
              <input
                className={inputClass}
                value={productQuery}
                onChange={(e) => {
                  setProductQuery(e.target.value);
                  setProductName(e.target.value);
                }}
                placeholder="Buscar por nome…"
                autoComplete="off"
                required
              />
              {productOptions.length > 0 ? (
                <ul className="mt-1 max-h-40 overflow-y-auto rounded border border-slate-200 bg-white text-sm shadow-sm">
                  {productOptions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left hover:bg-emerald-50"
                        onClick={() => pickProduct(p)}
                      >
                        {p.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <button
                type="button"
                className="mt-2 text-sm text-emerald-800 underline"
                onClick={() => setProductModal(true)}
              >
                Cadastrar produto rapidamente
              </button>
              <input type="hidden" name="productName" value={productName} />
            </Field>
            <Field label="Aplicado em">
              <input name="appliedAt" type="datetime-local" className={inputClass} required />
            </Field>
            <Field label="Carência (dias)">
              <input
                name="withdrawalDays"
                type="number"
                min={0}
                className={inputClass}
                required
                value={withdrawalDays}
                onChange={(e) => setWithdrawalDays(Number(e.target.value))}
              />
            </Field>
            <Field label="Observações">
              <input name="notes" className={inputClass} />
            </Field>
          </form>
        ) : (
          <form id="bio-visit-form" onSubmit={submitBio}>
            <Field label="Data/hora">
              <input name="visitedAt" type="datetime-local" className={inputClass} required />
            </Field>
            <Field label="Visitante">
              <input name="visitorName" className={inputClass} required />
            </Field>
            <Field label="Placa">
              <input name="vehiclePlate" className={inputClass} placeholder="ABC-1D23" />
            </Field>
            <Field label="Finalidade">
              <input name="purpose" className={inputClass} />
            </Field>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input name="epiUsed" type="checkbox" defaultChecked />
              EPI utilizado
            </label>
            <Field label="Observações">
              <input name="notes" className={inputClass} />
            </Field>
          </form>
        )}
      </FormCadastroModal>

      <FormCadastroModal
        open={productModal}
        onClose={() => setProductModal(false)}
        title="Novo produto sanitário"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setProductModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="sanitary-product-form">
              Cadastrar produto
            </Button>
          </>
        }
      >
        <form id="sanitary-product-form" onSubmit={createSanitaryProduct}>
          <Field label="Nome">
            <input name="name" className={inputClass} required />
          </Field>
          <Field label="Marca">
            <input name="brand" className={inputClass} />
          </Field>
          <Field label="Princípio ativo">
            <input name="activeIngredient" className={inputClass} />
          </Field>
          <Field label="Carência padrão (dias)">
            <input name="withdrawalDaysDefault" type="number" min={0} className={inputClass} defaultValue={0} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title={tab === 'eventos' ? 'Visualizar evento' : 'Visualizar visita'}
        sections={
          tab === 'eventos' && viewEvent
            ? [
                {
                  title: 'Evento',
                  fields: [
                    { label: 'Lote', value: viewEvent.flockLot.code },
                    { label: 'Tipo', value: healthTypeLabel(viewEvent.type) },
                    { label: 'Produto', value: viewEvent.productName },
                    { label: 'Aplicado em', value: new Date(viewEvent.appliedAt).toLocaleString('pt-BR') },
                    { label: 'Carência (dias)', value: viewEvent.withdrawalDays },
                  ],
                },
              ]
            : tab === 'bio' && viewBio
              ? [
                  {
                    title: 'Visita',
                    fields: [
                      { label: 'Data/hora', value: new Date(viewBio.visitedAt).toLocaleString('pt-BR') },
                      { label: 'Visitante', value: viewBio.visitorName },
                      { label: 'Placa', value: viewBio.vehiclePlate ?? '—' },
                      { label: 'EPI', value: viewBio.epiUsed ? 'Sim' : 'Não' },
                      { label: 'Finalidade', value: viewBio.purpose ?? '—' },
                    ],
                  },
                ]
              : []
        }
      />

      <ModuleReportsModal
        open={reportsOpen}
        title={reportsTitle}
        onClose={() => setReportsOpen(false)}
        compactLauncher
      />
    </AdminShell>
  );
}
