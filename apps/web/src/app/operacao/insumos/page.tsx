'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro, RecordViewModal, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { RecordHistorySection } from '@/components/operation/record-history-section';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { SUPPLY_MOVEMENT_KINDS, isRecordLocked, labelEnum } from '@/lib/labels';
import {
  lotLabel,
  todayIso,
  useBarnOptions,
  useLotOptions,
  useProductOptions,
  useStockLocationOptions,
} from '@/lib/operation-options';
import { readSession, sessionHasPermission } from '@/lib/session';

type SupplyRow = {
  id: string;
  controlNumber: number;
  date: string;
  kind: string;
  quantity: string;
  unit: string;
  notes: string | null;
  status: string;
  stockSyncedQty: string;
  createdByName: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  barn: { id: string; code: string; name: string } | null;
  flockLot: { id: string; code: string } | null;
  product: { id: string; sku: string; name: string; unit: string; type: string };
  stockLocation: { id: string; code: string; name: string } | null;
};

export default function InsumosPage() {
  const [rows, setRows] = useState<SupplyRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<SupplyRow | null>(null);
  const lots = useLotOptions();
  const barns = useBarnOptions();
  const products = useProductOptions();
  const locations = useStockLocationOptions();
  const session = readSession();
  const canWrite = sessionHasPermission(session, 'production.write');

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [r.product.name, r.product.sku, r.barn?.name, r.flockLot?.code, r.notes, labelEnum(r.kind)],
    dateField: (r) => r.date,
  });
  const pag = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<SupplyRow[]>('/v1/operation/supply-consumptions')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const editing = modal === 'edit' ? selected : null;
  const nonFeedProducts = products.filter((p) => p.type !== 'FEED');

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      date: fd.get('date'),
      barnId: (fd.get('barnId') as string) || undefined,
      flockLotId: (fd.get('flockLotId') as string) || undefined,
      productId: fd.get('productId'),
      stockLocationId: (fd.get('stockLocationId') as string) || undefined,
      kind: fd.get('kind'),
      quantity: Number(fd.get('quantity')),
      unit: (fd.get('unit') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
      reason: (fd.get('reason') as string) || undefined,
    };
    try {
      if (editing) {
        await apiFetch(`/v1/operation/supply-consumptions/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/operation/supply-consumptions', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  return (
    <AdminShell title="Consumo de insumos">
      <PageIntro
        title="Consumo de insumos"
        description="Medicamentos, vacinas, desinfetantes, materiais e outros insumos usados na operação, vinculados a produto de estoque, galpão e lote. A baixa no estoque ocorre após a conferência."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={
          canWrite
            ? () => {
                setSelected(null);
                setModal('include');
              }
            : undefined
        }
        label="Registrar consumo"
        searchPlaceholder="Produto, galpão, lote, observação…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Data', 'Produto', 'Tipo', 'Qtd', 'Galpão / Lote', 'Status', 'Ações']}
        recordItems={pag.slice}
        rows={pag.slice.map((r) => [
          formatCalendarDatePtBR(r.date),
          `${r.product.sku} — ${r.product.name}`,
          labelEnum(r.kind),
          `${Number(r.quantity).toLocaleString('pt-BR')} ${r.unit}`,
          [r.barn?.name, r.flockLot?.code].filter(Boolean).join(' · ') || '—',
          <RecordStatusBadge key={`${r.id}-s`} status={r.status} />,
          <RowActions
            key={r.id}
            onView={() => {
              setSelected(r);
              setViewOpen(true);
            }}
            onEdit={
              canWrite
                ? () => {
                    setSelected(r);
                    setModal('edit');
                  }
                : undefined
            }
          />,
        ])}
        page={pag.page}
        totalPages={pag.totalPages}
        total={pag.total}
        onPage={pag.setPage}
      />

      <FormCadastroModal
        open={modal === 'include' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={editing ? 'Alterar consumo de insumo' : 'Registrar consumo de insumo'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="supply-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="supply-form" onSubmit={save} key={editing?.id ?? 'new'} className="grid md:grid-cols-2 md:gap-x-4">
          <Field label="Data">
            <input name="date" type="date" className={inputClass} required defaultValue={editing ? editing.date.slice(0, 10) : todayIso()} />
          </Field>
          <Field label="Tipo de movimentação">
            <select name="kind" className={inputClass} defaultValue={editing?.kind ?? 'CONSUMPTION'}>
              {SUPPLY_MOVEMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {labelEnum(k)}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2">
            <Field label="Produto (estoque)">
              <select name="productId" className={inputClass} required defaultValue={editing?.product.id ?? ''}>
                <option value="">Selecione</option>
                {(nonFeedProducts.length ? nonFeedProducts : products).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name} ({labelEnum(p.type)})
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Quantidade">
            <input name="quantity" type="number" step="0.001" min={0} className={inputClass} required defaultValue={editing?.quantity ?? ''} />
          </Field>
          <Field label="Unidade (vazio = unidade do produto)">
            <input name="unit" className={inputClass} defaultValue={editing?.unit ?? ''} placeholder="UN, KG, L, ML…" />
          </Field>
          <Field label="Galpão">
            <select name="barnId" className={inputClass} defaultValue={editing?.barn?.id ?? ''}>
              <option value="">—</option>
              {barns.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lote">
            <select name="flockLotId" className={inputClass} defaultValue={editing?.flockLot?.id ?? ''}>
              <option value="">—</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {lotLabel(l)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local de estoque (origem da baixa)">
            <select name="stockLocationId" className={inputClass} defaultValue={editing?.stockLocation?.id ?? ''}>
              <option value="">—</option>
              {locations.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} — {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Observações">
            <input name="notes" className={inputClass} defaultValue={editing?.notes ?? ''} />
          </Field>
          {editing ? (
            <div className="md:col-span-2">
              <Field label={isRecordLocked(editing.status) ? 'Justificativa (obrigatória — registro conferido)' : 'Justificativa da alteração'}>
                <input name="reason" className={inputClass} required={isRecordLocked(editing.status)} />
              </Field>
            </div>
          ) : null}
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Consumo de insumo"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Consumo',
                  fields: [
                    { label: 'Data', value: formatCalendarDatePtBR(selected.date) },
                    { label: 'Produto', value: `${selected.product.sku} — ${selected.product.name}` },
                    { label: 'Tipo', value: labelEnum(selected.kind) },
                    { label: 'Quantidade', value: `${Number(selected.quantity).toLocaleString('pt-BR')} ${selected.unit}` },
                    { label: 'Galpão', value: selected.barn ? `${selected.barn.code} — ${selected.barn.name}` : '—' },
                    { label: 'Lote', value: selected.flockLot?.code ?? '—' },
                    { label: 'Local de estoque', value: selected.stockLocation ? `${selected.stockLocation.code} — ${selected.stockLocation.name}` : '—' },
                    { label: 'Observações', value: selected.notes ?? '—' },
                  ],
                },
                {
                  title: 'Registro e conferência',
                  fields: [
                    { label: 'Status', value: labelEnum(selected.status) },
                    { label: 'Registrado por', value: selected.createdByName ?? '—' },
                    {
                      label: 'Conferido por',
                      value: selected.reviewedByName
                        ? `${selected.reviewedByName}${selected.reviewedAt ? ` em ${new Date(selected.reviewedAt).toLocaleString('pt-BR')}` : ''}`
                        : '—',
                    },
                    { label: 'Baixado no estoque', value: `${Number(selected.stockSyncedQty).toLocaleString('pt-BR')} ${selected.unit}` },
                  ],
                },
                { title: 'Histórico de alterações', content: <RecordHistorySection entity="SupplyConsumption" id={selected.id} /> },
              ]
            : []
        }
      />
    </AdminShell>
  );
}
