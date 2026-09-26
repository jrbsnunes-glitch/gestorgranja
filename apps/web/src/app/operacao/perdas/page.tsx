'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro, RecordViewModal, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { RecordHistorySection } from '@/components/operation/record-history-section';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { OPERATIONAL_LOSS_TYPES, labelEnum } from '@/lib/labels';
import { lotLabel, todayIso, useBarnOptions, useLotOptions, useProductOptions } from '@/lib/operation-options';
import { readSession, sessionHasPermission } from '@/lib/session';

type LossRow = {
  id: string;
  controlNumber: number;
  date: string;
  type: string;
  location: string | null;
  quantity: string;
  unit: string;
  reason: string | null;
  actionTaken: string | null;
  notes: string | null;
  estimatedCost: string | null;
  createdByName: string | null;
  barn: { id: string; code: string; name: string } | null;
  flockLot: { id: string; code: string } | null;
  product: { id: string; sku: string; name: string; unit: string } | null;
};

const UNIT_BY_TYPE: Record<string, string> = { EGG: 'UN', FEED: 'KG', BIRD: 'UN', SUPPLY: 'UN', EQUIPMENT: 'UN', OTHER: 'UN' };

export default function PerdasPage() {
  const [rows, setRows] = useState<LossRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selected, setSelected] = useState<LossRow | null>(null);
  const [type, setType] = useState('EGG');
  const lots = useLotOptions();
  const barns = useBarnOptions();
  const products = useProductOptions();
  const session = readSession();
  const canWrite = sessionHasPermission(session, 'production.write') || sessionHasPermission(session, 'occurrences.write');

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [labelEnum(r.type), r.barn?.name, r.flockLot?.code, r.location, r.reason, r.product?.name],
    dateField: (r) => r.date,
  });
  const pag = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<LossRow[]>('/v1/operation/losses')
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const editing = modal === 'edit' ? selected : null;

  function openForm(row?: LossRow) {
    setSelected(row ?? null);
    setType(row?.type ?? 'EGG');
    setModal(row ? 'edit' : 'include');
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      date: fd.get('date'),
      type: fd.get('type'),
      barnId: (fd.get('barnId') as string) || undefined,
      flockLotId: (fd.get('flockLotId') as string) || undefined,
      productId: (fd.get('productId') as string) || undefined,
      location: (fd.get('location') as string) || undefined,
      quantity: Number(fd.get('quantity')),
      unit: (fd.get('unit') as string) || undefined,
      reason: (fd.get('reason') as string) || undefined,
      actionTaken: (fd.get('actionTaken') as string) || undefined,
      notes: (fd.get('notes') as string) || undefined,
      estimatedCost: fd.get('estimatedCost') ? Number(fd.get('estimatedCost')) : undefined,
    };
    try {
      if (editing) {
        await apiFetch(`/v1/operation/losses/${editing.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/operation/losses', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  const totalCost = list.filtered.reduce((s, r) => s + Number(r.estimatedCost ?? 0), 0);

  return (
    <AdminShell title="Perdas operacionais">
      <PageIntro
        title="Perdas operacionais"
        description="Perdas fora do fluxo normal (ovos quebrados no manuseio, ração desperdiçada, insumos vencidos, aves por acidente, equipamentos) com causa, ação tomada e custo estimado."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={canWrite ? () => openForm() : undefined}
        label="Registrar perda"
        searchPlaceholder="Tipo, galpão, lote, causa…"
        showDateFilter
      />
      {list.filtered.length ? (
        <p className="mb-2 text-xs text-slate-600">
          {list.filtered.length} registro(s) · custo estimado total: R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </p>
      ) : null}
      <PaginatedTable
        headers={['Data', 'Tipo', 'Qtd', 'Galpão / Lote', 'Causa', 'Custo est. (R$)', 'Ações']}
        recordItems={pag.slice}
        rows={pag.slice.map((r) => [
          formatCalendarDatePtBR(r.date),
          labelEnum(r.type),
          `${Number(r.quantity).toLocaleString('pt-BR')} ${r.unit}`,
          [r.barn?.name, r.flockLot?.code, r.location].filter(Boolean).join(' · ') || '—',
          r.reason ?? '—',
          r.estimatedCost ? Number(r.estimatedCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—',
          <RowActions
            key={r.id}
            onView={() => {
              setSelected(r);
              setViewOpen(true);
            }}
            onEdit={canWrite ? () => openForm(r) : undefined}
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
        title={editing ? 'Alterar perda' : 'Registrar perda'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="loss-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="loss-form" onSubmit={save} key={editing?.id ?? 'new'} className="grid md:grid-cols-2 md:gap-x-4">
          <Field label="Data">
            <input name="date" type="date" className={inputClass} required defaultValue={editing ? editing.date.slice(0, 10) : todayIso()} />
          </Field>
          <Field label="Tipo de perda">
            <select name="type" className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
              {OPERATIONAL_LOSS_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelEnum(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" step="0.001" min={0} className={inputClass} required defaultValue={editing?.quantity ?? ''} />
          </Field>
          <Field label="Unidade">
            <input name="unit" className={inputClass} key={`unit-${type}`} defaultValue={editing?.unit ?? UNIT_BY_TYPE[type] ?? 'UN'} />
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
          {type === 'FEED' || type === 'SUPPLY' ? (
            <Field label="Produto (estoque)">
              <select name="productId" className={inputClass} defaultValue={editing?.product?.id ?? ''}>
                <option value="">—</option>
                {products
                  .filter((p) => (type === 'FEED' ? p.type === 'FEED' : p.type !== 'FEED'))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : null}
          <Field label="Local">
            <input name="location" className={inputClass} defaultValue={editing?.location ?? ''} placeholder="Sala de ovos, silo 2, corredor…" />
          </Field>
          <div className="md:col-span-2">
            <Field label="Causa / motivo">
              <input name="reason" className={inputClass} defaultValue={editing?.reason ?? ''} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="Ação tomada">
              <input name="actionTaken" className={inputClass} defaultValue={editing?.actionTaken ?? ''} />
            </Field>
          </div>
          <Field label="Custo estimado (R$)">
            <input name="estimatedCost" type="number" step="0.01" min={0} className={inputClass} defaultValue={editing?.estimatedCost ?? ''} />
          </Field>
          <Field label="Observações">
            <input name="notes" className={inputClass} defaultValue={editing?.notes ?? ''} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Perda operacional"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Perda',
                  fields: [
                    { label: 'Data', value: formatCalendarDatePtBR(selected.date) },
                    { label: 'Tipo', value: labelEnum(selected.type) },
                    { label: 'Quantidade', value: `${Number(selected.quantity).toLocaleString('pt-BR')} ${selected.unit}` },
                    { label: 'Galpão', value: selected.barn ? `${selected.barn.code} — ${selected.barn.name}` : '—' },
                    { label: 'Lote', value: selected.flockLot?.code ?? '—' },
                    { label: 'Produto', value: selected.product ? `${selected.product.sku} — ${selected.product.name}` : '—' },
                    { label: 'Local', value: selected.location ?? '—' },
                    { label: 'Causa', value: selected.reason ?? '—' },
                    { label: 'Ação tomada', value: selected.actionTaken ?? '—' },
                    {
                      label: 'Custo estimado',
                      value: selected.estimatedCost ? `R$ ${Number(selected.estimatedCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—',
                    },
                    { label: 'Observações', value: selected.notes ?? '—' },
                    { label: 'Registrado por', value: selected.createdByName ?? '—' },
                  ],
                },
                { title: 'Histórico de alterações', content: <RecordHistorySection entity="OperationalLoss" id={selected.id} /> },
              ]
            : []
        }
      />
    </AdminShell>
  );
}
