'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro, RecordViewModal, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, TabBar, usePagination, type ModalMode } from '@/components/list-crud';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import {
  OCCURRENCE_PRIORITIES,
  OCCURRENCE_STATUSES,
  OCCURRENCE_TYPES,
  labelEnum,
} from '@/lib/labels';
import {
  lotLabel,
  toLocalDateTimeInput,
  useAssetOptions,
  useBarnOptions,
  useLotOptions,
} from '@/lib/operation-options';
import { readSession, sessionHasPermission } from '@/lib/session';

type Occurrence = {
  id: string;
  controlNumber: number;
  occurredAt: string;
  type: string;
  location: string | null;
  description: string;
  priority: string;
  status: string;
  actionTaken: string | null;
  resolvedAt: string | null;
  resolverName: string | null;
  createdByName: string | null;
  barn: { id: string; code: string; name: string } | null;
  flockLot: { id: string; code: string } | null;
  asset: { id: string; code: string; name: string } | null;
  maintenanceRecord: { id: string; performedAt: string; kind: string; cost: string | null } | null;
};

type Filter = 'abertas' | 'todas' | 'encerradas';

const PRIORITY_STYLE: Record<string, string> = {
  LOW: 'text-slate-600',
  MEDIUM: 'text-slate-800',
  HIGH: 'text-amber-700 font-medium',
  CRITICAL: 'text-red-700 font-semibold',
};

export default function OcorrenciasPage() {
  const [rows, setRows] = useState<Occurrence[]>([]);
  const [filter, setFilter] = useState<Filter>('abertas');
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [maintOpen, setMaintOpen] = useState(false);
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const lots = useLotOptions();
  const barns = useBarnOptions();
  const assets = useAssetOptions();
  const session = readSession();
  const canWrite = sessionHasPermission(session, 'occurrences.write') || sessionHasPermission(session, 'production.write');
  const canManage = sessionHasPermission(session, 'occurrences.write');

  const list = useCrudList({
    items: rows,
    searchFields: (o) => [o.description, o.barn?.name, o.flockLot?.code, o.location, labelEnum(o.type)],
    dateField: (o) => o.occurredAt,
  });
  const pag = usePagination(list.filtered);

  const load = useCallback(() => {
    const status =
      filter === 'abertas' ? 'OPEN,IN_PROGRESS' : filter === 'encerradas' ? 'RESOLVED,CANCELLED' : undefined;
    void apiFetch<Occurrence[]>(`/v1/operation/occurrences${status ? `?status=${status}` : ''}`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(mode: 'include' | 'edit', row?: Occurrence) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const common = {
      occurredAt: new Date(String(fd.get('occurredAt'))).toISOString(),
      barnId: (fd.get('barnId') as string) || (modal === 'edit' ? null : undefined),
      flockLotId: (fd.get('flockLotId') as string) || (modal === 'edit' ? null : undefined),
      type: fd.get('type'),
      location: (fd.get('location') as string) || (modal === 'edit' ? null : undefined),
      description: fd.get('description'),
      priority: fd.get('priority'),
      assetId: (fd.get('assetId') as string) || (modal === 'edit' ? null : undefined),
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/operation/occurrences/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...common,
            status: fd.get('status'),
            actionTaken: (fd.get('actionTaken') as string) || null,
          }),
        });
      } else {
        await apiFetch('/v1/operation/occurrences', { method: 'POST', body: JSON.stringify(common) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  async function quickStatus(row: Occurrence, status: string) {
    setError(null);
    let actionTaken: string | null | undefined;
    if (status === 'RESOLVED' && !row.actionTaken) {
      actionTaken = window.prompt('Ação tomada para encerrar a ocorrência:') ?? undefined;
      if (!actionTaken) return;
    }
    try {
      await apiFetch(`/v1/operation/occurrences/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, ...(actionTaken ? { actionTaken } : {}) }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function saveMaintenance(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/v1/operation/occurrences/${selected.id}/maintenance`, {
        method: 'POST',
        body: JSON.stringify({
          assetId: (fd.get('assetId') as string) || undefined,
          kind: (fd.get('kind') as string) || undefined,
          description: (fd.get('description') as string) || undefined,
          cost: fd.get('cost') ? Number(fd.get('cost')) : undefined,
        }),
      });
      setMaintOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir manutenção');
    }
  }

  return (
    <AdminShell title="Ocorrências operacionais">
      <PageIntro
        title="Ocorrências operacionais"
        description="Equipamentos, água, energia, ambiente, anormalidades de produção e outras situações relevantes — com prioridade, status, ação tomada e vínculo com manutenção."
      />
      <ErrorBox message={error} />
      <TabBar
        active={filter}
        onChange={(id) => setFilter(id as Filter)}
        tabs={[
          { id: 'abertas', label: 'Abertas / em andamento' },
          { id: 'encerradas', label: 'Encerradas' },
          { id: 'todas', label: 'Todas' },
        ]}
      />
      <ListToolbar
        list={list}
        onInclude={canWrite ? () => openForm('include') : undefined}
        label="Registrar ocorrência"
        searchPlaceholder="Descrição, galpão, lote, local…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Data/hora', 'Tipo', 'Local', 'Descrição', 'Prioridade', 'Status', 'Ações']}
        recordItems={pag.slice}
        rows={pag.slice.map((o) => [
          new Date(o.occurredAt).toLocaleString('pt-BR'),
          labelEnum(o.type),
          [o.barn?.name, o.flockLot?.code, o.location].filter(Boolean).join(' · ') || '—',
          <span key={`${o.id}-d`} className="line-clamp-2 max-w-md">
            {o.description}
          </span>,
          <span key={`${o.id}-p`} className={PRIORITY_STYLE[o.priority] ?? ''}>
            {labelEnum(o.priority)}
          </span>,
          <RecordStatusBadge key={`${o.id}-s`} status={o.status} />,
          <span key={o.id} className="flex flex-wrap items-center gap-1.5 max-sm:w-full max-sm:justify-end">
            <RowActions
              onView={() => {
                setSelected(o);
                setViewOpen(true);
              }}
              onEdit={canManage ? () => openForm('edit', o) : undefined}
            />
            {canManage && o.status === 'OPEN' ? (
              <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => quickStatus(o, 'IN_PROGRESS')}>
                Em andamento
              </Button>
            ) : null}
            {canManage && (o.status === 'OPEN' || o.status === 'IN_PROGRESS') ? (
              <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => quickStatus(o, 'RESOLVED')}>
                Encerrar
              </Button>
            ) : null}
            {canManage && !o.maintenanceRecord && (o.type === 'EQUIPMENT' || o.asset) ? (
              <Button
                type="button"
                variant="secondary"
                className="px-2 py-1 text-xs"
                onClick={() => {
                  setSelected(o);
                  setMaintOpen(true);
                }}
              >
                Abrir manutenção
              </Button>
            ) : null}
          </span>,
        ])}
        page={pag.page}
        totalPages={pag.totalPages}
        total={pag.total}
        onPage={pag.setPage}
      />

      <FormCadastroModal
        open={modal === 'include' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'edit' ? 'Alterar ocorrência' : 'Registrar ocorrência'}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="occ-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="occ-form" onSubmit={save} key={selected?.id ?? 'new'} className="grid gap-0 md:grid-cols-2 md:gap-x-4">
          <Field label="Data e hora">
            <input
              name="occurredAt"
              type="datetime-local"
              className={inputClass}
              required
              defaultValue={toLocalDateTimeInput(selected?.occurredAt ?? new Date())}
            />
          </Field>
          <Field label="Tipo">
            <select name="type" className={inputClass} defaultValue={selected?.type ?? 'EQUIPMENT'} required>
              {OCCURRENCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelEnum(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Galpão">
            <select name="barnId" className={inputClass} defaultValue={selected?.barn?.id ?? ''}>
              <option value="">—</option>
              {barns.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Lote">
            <select name="flockLotId" className={inputClass} defaultValue={selected?.flockLot?.id ?? ''}>
              <option value="">—</option>
              {lots.map((l) => (
                <option key={l.id} value={l.id}>
                  {lotLabel(l)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Local (descrição livre)">
            <input name="location" className={inputClass} defaultValue={selected?.location ?? ''} placeholder="Ex.: linha de bebedouros 3" />
          </Field>
          <Field label="Prioridade">
            <select name="priority" className={inputClass} defaultValue={selected?.priority ?? 'MEDIUM'}>
              {OCCURRENCE_PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {labelEnum(p)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Equipamento (patrimônio)">
            <select name="assetId" className={inputClass} defaultValue={selected?.asset?.id ?? ''}>
              <option value="">—</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          {modal === 'edit' ? (
            <Field label="Status">
              <select name="status" className={inputClass} defaultValue={selected?.status ?? 'OPEN'}>
                {OCCURRENCE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {labelEnum(s)}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <div className="md:col-span-2">
            <Field label="Descrição">
              <textarea name="description" className={`${inputClass} min-h-20`} required defaultValue={selected?.description ?? ''} />
            </Field>
          </div>
          {modal === 'edit' ? (
            <div className="md:col-span-2">
              <Field label="Ação tomada (obrigatória para encerrar)">
                <textarea name="actionTaken" className={`${inputClass} min-h-16`} defaultValue={selected?.actionTaken ?? ''} />
              </Field>
            </div>
          ) : null}
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={maintOpen}
        onClose={() => setMaintOpen(false)}
        title="Abrir manutenção a partir da ocorrência"
        wide={false}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setMaintOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="maint-form">
              Abrir manutenção
            </Button>
          </>
        }
      >
        <form id="maint-form" onSubmit={saveMaintenance} key={selected?.id ?? 'maint'}>
          <Field label="Equipamento">
            <select name="assetId" className={inputClass} defaultValue={selected?.asset?.id ?? ''} required={!selected?.asset}>
              <option value="">{selected?.asset ? `${selected.asset.code} — ${selected.asset.name}` : 'Selecione'}</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tipo de manutenção">
            <input name="kind" className={inputClass} defaultValue="CORRETIVA" />
          </Field>
          <Field label="Descrição">
            <input name="description" className={inputClass} defaultValue={selected?.description ?? ''} />
          </Field>
          <Field label="Custo estimado (R$)">
            <input name="cost" type="number" step="0.01" min={0} className={inputClass} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Ocorrência"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Ocorrência',
                  fields: [
                    { label: 'Data/hora', value: new Date(selected.occurredAt).toLocaleString('pt-BR') },
                    { label: 'Tipo', value: labelEnum(selected.type) },
                    { label: 'Galpão', value: selected.barn ? `${selected.barn.code} — ${selected.barn.name}` : '—' },
                    { label: 'Lote', value: selected.flockLot?.code ?? '—' },
                    { label: 'Local', value: selected.location ?? '—' },
                    { label: 'Prioridade', value: labelEnum(selected.priority) },
                    { label: 'Status', value: labelEnum(selected.status) },
                    { label: 'Descrição', value: selected.description },
                    { label: 'Registrada por', value: selected.createdByName ?? '—' },
                  ],
                },
                {
                  title: 'Tratamento',
                  fields: [
                    { label: 'Ação tomada', value: selected.actionTaken ?? '—' },
                    { label: 'Responsável pela solução', value: selected.resolverName ?? '—' },
                    { label: 'Encerrada em', value: selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleString('pt-BR') : '—' },
                    { label: 'Equipamento', value: selected.asset ? `${selected.asset.code} — ${selected.asset.name}` : '—' },
                    {
                      label: 'Manutenção vinculada',
                      value: selected.maintenanceRecord
                        ? `${selected.maintenanceRecord.kind} em ${new Date(selected.maintenanceRecord.performedAt).toLocaleDateString('pt-BR')}${
                            selected.maintenanceRecord.cost ? ` — R$ ${Number(selected.maintenanceRecord.cost).toFixed(2)}` : ''
                          }`
                        : '—',
                    },
                  ],
                },
              ]
            : []
        }
      />
    </AdminShell>
  );
}
