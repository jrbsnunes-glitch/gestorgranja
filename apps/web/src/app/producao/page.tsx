'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import { ProductionReportLauncher } from '@/components/production-report-launcher';
import {
  ListToolbar,
  PaginatedTable,
  RowActions,
  TabBar,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { RecordHistorySection } from '@/components/operation/record-history-section';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import {
  EGG_PRODUCTION_FIELDS,
  MORTALITY_CAUSES,
  isRecordLocked,
  labelEggProductionField,
  labelEnum,
} from '@/lib/labels';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { useProductOptions, useStockLocationOptions } from '@/lib/operation-options';

type Lot = { id: string; code: string; barn: { id: string; name: string } };
type Barn = { id: string; code: string; name: string };

type RecordMeta = {
  status?: string;
  shift?: string | null;
  createdByName?: string | null;
  reviewedByName?: string | null;
  reviewedAt?: string | null;
};

type EggRow = RecordMeta & {
  id: string;
  date: string;
  extra: number;
  large: number;
  medium: number;
  small: number;
  cracked?: number;
  dirty?: number;
  deformed?: number;
  discard?: number;
  discardReason?: string | null;
  avgEggWeightG?: number | null;
  notes?: string | null;
  flockLot: { code: string };
};

function dateInputValue(iso: string) {
  return iso.slice(0, 10);
}

function eggCommercialQty(r: EggRow) {
  return r.extra + r.large + r.medium + r.small;
}

type MortRow = RecordMeta & {
  id: string;
  date: string;
  quantity: number;
  cause?: string;
  causeNotes: string | null;
  flockLot: { code: string };
};
type FeedRow = RecordMeta & {
  id: string;
  date: string;
  consumedKg: string;
  leftoverKg: string;
  productId?: string | null;
  stockLocationId?: string | null;
  product?: { id: string; sku: string; name: string } | null;
  flockLot: { code: string };
};

/** Campo de justificativa exibido ao alterar (obrigatório se o registro já foi conferido). */
function ReasonField({ locked }: { locked: boolean }) {
  return (
    <Field label={locked ? 'Justificativa da alteração (obrigatória — registro conferido)' : 'Justificativa da alteração'}>
      <input name="reason" className={inputClass} required={locked} placeholder="Por que o registro está sendo alterado?" />
    </Field>
  );
}

function recordMetaFields(r: RecordMeta) {
  return [
    { label: 'Status', value: labelEnum(r.status ?? 'RECORDED') },
    { label: 'Turno', value: r.shift ?? '—' },
    { label: 'Registrado por', value: r.createdByName ?? '—' },
    {
      label: 'Conferido por',
      value: r.reviewedByName
        ? `${r.reviewedByName}${r.reviewedAt ? ` em ${new Date(r.reviewedAt).toLocaleString('pt-BR')}` : ''}`
        : '—',
    },
  ];
}
type EnvRow = {
  id: string;
  recordedAt: string;
  temperatureC: number | null;
  humidityPct: number | null;
  ventilationNote: string | null;
  barn: { code: string; name: string };
};
type TransferRow = {
  id: string;
  date: string;
  quantityKg: string;
  fromLot: { code: string };
  toLot: { code: string };
};

type TabId = 'postura' | 'mortalidade' | 'racao' | 'ambiente' | 'transferencia';

const TAB_IDS: TabId[] = ['postura', 'mortalidade', 'racao', 'ambiente', 'transferencia'];

function parseProducaoTab(raw: string | null): TabId {
  if (raw && TAB_IDS.includes(raw as TabId)) return raw as TabId;
  return 'postura';
}

export default function ProducaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabId>(() => parseProducaoTab(searchParams.get('tab')));
  const [lots, setLots] = useState<Lot[]>([]);
  const [barns, setBarns] = useState<Barn[]>([]);
  const [lotId, setLotId] = useState('');
  const [barnId, setBarnId] = useState('');
  const [transferToLotId, setTransferToLotId] = useState('');
  const [eggs, setEggs] = useState<EggRow[]>([]);
  const [morts, setMorts] = useState<MortRow[]>([]);
  const [feeds, setFeeds] = useState<FeedRow[]>([]);
  const [envs, setEnvs] = useState<EnvRow[]>([]);
  const [transfers, setTransfers] = useState<TransferRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selectedEgg, setSelectedEgg] = useState<EggRow | null>(null);
  const [selectedMort, setSelectedMort] = useState<MortRow | null>(null);
  const [selectedFeed, setSelectedFeed] = useState<FeedRow | null>(null);
  const [selectedEnv, setSelectedEnv] = useState<EnvRow | null>(null);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRow | null>(null);
  const feedProducts = useProductOptions('FEED');
  const stockLocations = useStockLocationOptions();

  const eggList = useCrudList({
    items: eggs,
    searchFields: (r) => [r.flockLot.code],
    dateField: (r) => r.date,
  });
  const mortList = useCrudList({
    items: morts,
    searchFields: (r) => [r.flockLot.code, r.causeNotes],
    dateField: (r) => r.date,
  });
  const feedList = useCrudList({
    items: feeds,
    searchFields: (r) => [r.flockLot.code],
    dateField: (r) => r.date,
  });
  const envList = useCrudList({
    items: envs,
    searchFields: (r) => [r.barn.code, r.barn.name, r.ventilationNote],
    dateField: (r) => r.recordedAt,
  });
  const transferList = useCrudList({
    items: transfers,
    searchFields: (r) => [r.fromLot.code, r.toLot.code],
    dateField: (r) => r.date,
  });

  const eggPag = usePagination(eggList.filtered);
  const mortPag = usePagination(mortList.filtered);
  const feedPag = usePagination(feedList.filtered);
  const envPag = usePagination(envList.filtered);
  const trPag = usePagination(transferList.filtered);

  const activeList = useMemo(() => {
    switch (tab) {
      case 'postura':
        return eggList;
      case 'mortalidade':
        return mortList;
      case 'racao':
        return feedList;
      case 'ambiente':
        return envList;
      case 'transferencia':
        return transferList;
    }
  }, [tab, eggList, mortList, feedList, envList, transferList]);

  const today = new Date().toISOString().slice(0, 10);
  const editingEgg = modal === 'edit' && tab === 'postura' ? selectedEgg : null;
  const editingMort = modal === 'edit' && tab === 'mortalidade' ? selectedMort : null;
  const editingFeed = modal === 'edit' && tab === 'racao' ? selectedFeed : null;

  function openInclude() {
    setSelectedEgg(null);
    setSelectedMort(null);
    setSelectedFeed(null);
    setModal('include');
  }

  function lotIdForCode(code: string) {
    return lots.find((l) => l.code === code)?.id ?? lotId;
  }

  const load = useCallback(() => {
    void apiFetch<EggRow[]>('/v1/production/daily-eggs').then(setEggs);
    void apiFetch<MortRow[]>('/v1/production/daily-mortality').then(setMorts);
    void apiFetch<FeedRow[]>('/v1/nutrition/daily-feed').then(setFeeds);
    void apiFetch<EnvRow[]>('/v1/production/environmental').then(setEnvs);
    void apiFetch<TransferRow[]>('/v1/nutrition/feed-transfers').then(setTransfers);
  }, []);

  useEffect(() => {
    setTab(parseProducaoTab(searchParams.get('tab')));
  }, [searchParams]);

  const setProducaoTab = useCallback(
    (id: TabId) => {
      setTab(id);
      const path = id === 'postura' ? '/producao' : `/producao?tab=${id}`;
      router.replace(path, { scroll: false });
    },
    [router],
  );

  useEffect(() => {
    void apiFetch<Lot[]>('/v1/production/lots').then((rows) => {
      setLots(rows);
      if (rows[0]) {
        setLotId(rows[0].id);
        setTransferToLotId(rows[1]?.id ?? rows[0].id);
      }
    });
    void apiFetch<Barn[]>('/v1/cadastros/barns').then((rows) => {
      setBarns(rows);
      if (rows[0]) setBarnId(rows[0].id);
    });
    load();
  }, [load]);

  async function submitEgg(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/production/daily-eggs', {
        method: 'POST',
        body: JSON.stringify({
          flockLotId: lotId,
          date: fd.get('date'),
          extra: Number(fd.get('extra') || 0),
          large: Number(fd.get('large') || 0),
          medium: Number(fd.get('medium') || 0),
          small: Number(fd.get('small') || 0),
          cracked: Number(fd.get('cracked') || 0),
          dirty: Number(fd.get('dirty') || 0),
          deformed: Number(fd.get('deformed') || 0),
          discard: Number(fd.get('discard') || 0),
          avgEggWeightG: fd.get('avgEggWeightG') ? Number(fd.get('avgEggWeightG')) : undefined,
          discardReason: fd.get('discardReason') || undefined,
          shift: fd.get('shift') || undefined,
          reason: fd.get('reason') || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitMortality(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const body = {
        flockLotId: lotId,
        date: fd.get('date'),
        quantity: Number(fd.get('quantity')),
        cause: fd.get('cause') || undefined,
        causeNotes: fd.get('causeNotes') || undefined,
        shift: fd.get('shift') || undefined,
        reason: fd.get('reason') || undefined,
      };
      if (editingMort) {
        await apiFetch(`/v1/production/daily-mortality/${editingMort.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/v1/production/daily-mortality', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitFeed(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/nutrition/daily-feed', {
        method: 'POST',
        body: JSON.stringify({
          flockLotId: lotId,
          date: fd.get('date'),
          consumedKg: Number(fd.get('consumedKg')),
          leftoverKg: Number(fd.get('leftoverKg') || 0),
          productId: (fd.get('productId') as string) || undefined,
          stockLocationId: (fd.get('stockLocationId') as string) || undefined,
          shift: fd.get('shift') || undefined,
          reason: fd.get('reason') || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitEnvironmental(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/production/environmental', {
        method: 'POST',
        body: JSON.stringify({
          barnId,
          temperatureC: fd.get('temperatureC') ? Number(fd.get('temperatureC')) : undefined,
          humidityPct: fd.get('humidityPct') ? Number(fd.get('humidityPct')) : undefined,
          ventilationNote: fd.get('ventilationNote') || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitTransfer(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/nutrition/feed-transfer', {
        method: 'POST',
        body: JSON.stringify({
          fromLotId: lotId,
          toLotId: transferToLotId,
          date: fd.get('date'),
          quantityKg: Number(fd.get('quantityKg')),
          notes: fd.get('notes') || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const reportsTitle =
    tab === 'postura'
      ? 'Postura'
      : tab === 'mortalidade'
        ? 'Mortalidade'
        : tab === 'racao'
          ? 'Ração'
          : tab === 'ambiente'
            ? 'Ambiente'
            : 'Transferência de ração';

  const searchPlaceholder =
    tab === 'postura' || tab === 'mortalidade' || tab === 'racao'
      ? 'Lote…'
      : tab === 'ambiente'
        ? 'Galpão ou observação…'
        : 'Lote origem ou destino…';

  const formTitle =
    modal === 'edit'
      ? 'Editar lançamento'
      : tab === 'postura'
        ? 'Incluir postura'
        : tab === 'mortalidade'
          ? 'Incluir mortalidade'
          : tab === 'racao'
            ? 'Incluir consumo de ração'
            : tab === 'ambiente'
              ? 'Incluir leitura ambiental'
              : 'Incluir transferência';

  const formOpen =
    modal === 'include' ||
    (modal === 'edit' && (tab === 'postura' || tab === 'mortalidade' || tab === 'racao'));

  const formId =
    tab === 'postura'
      ? 'egg-form'
      : tab === 'mortalidade'
        ? 'mort-form'
        : tab === 'racao'
          ? 'feed-form'
          : tab === 'ambiente'
            ? 'env-form'
            : 'transfer-form';

  const lotSelect = (
    <Field label="Lote">
      <select className={inputClass} value={lotId} onChange={(e) => setLotId(e.target.value)}>
        {lots.map((l) => (
          <option key={l.id} value={l.id}>
            {l.code} — {l.barn.name}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <AdminShell title="Produção — lançamentos diários">
      <PageIntro
        title="Produção — lançamentos diários"
        description="Postura, mortalidade, ração, ambiente e transferências entre lotes."
      />
      <ErrorBox message={error} />
      <TabBar
        active={tab}
        onChange={(id) => setProducaoTab(id as TabId)}
        tabs={[
          { id: 'postura', label: 'Postura' },
          { id: 'mortalidade', label: 'Mortalidade' },
          { id: 'racao', label: 'Ração' },
          { id: 'ambiente', label: 'Ambiente' },
          { id: 'transferencia', label: 'Transferência' },
        ]}
      />

      <ListToolbar
        list={activeList}
        onInclude={
          tab === 'ambiente' || tab === 'transferencia' ? () => setModal('include') : openInclude
        }
        onReports={() => setReportsOpen(true)}
        searchPlaceholder={searchPlaceholder}
        showDateFilter
        showPrint={false}
      />

      {tab === 'postura' ? (
        <PaginatedTable
          headers={['Data', 'Lote', 'Comerciais (un)', 'Status', 'Ações']}
          recordItems={eggPag.slice}
          rows={eggPag.slice.map((r) => [
            formatCalendarDatePtBR(r.date),
            r.flockLot.code,
            String(eggCommercialQty(r)),
            <RecordStatusBadge key={`${r.id}-st`} status={r.status ?? 'RECORDED'} />,
            <RowActions
              key={r.id}
              onView={() => {
                setSelectedEgg(r);
                setViewOpen(true);
              }}
              onEdit={() => {
                setLotId(lotIdForCode(r.flockLot.code));
                setSelectedEgg(r);
                setModal('edit');
              }}
            />,
          ])}
          page={eggPag.page}
          totalPages={eggPag.totalPages}
          total={eggPag.total}
          onPage={eggPag.setPage}
        />
      ) : null}

      {tab === 'mortalidade' ? (
        <PaginatedTable
          headers={['Data', 'Lote', 'Qtd', 'Causa', 'Status', 'Ações']}
          recordItems={mortPag.slice}
          rows={mortPag.slice.map((r) => [
            formatCalendarDatePtBR(r.date),
            r.flockLot.code,
            String(r.quantity),
            labelEnum(r.cause ?? 'UNKNOWN'),
            <RecordStatusBadge key={`${r.id}-st`} status={r.status ?? 'RECORDED'} />,
            <RowActions
              key={r.id}
              onView={() => {
                setSelectedMort(r);
                setViewOpen(true);
              }}
              onEdit={() => {
                setLotId(lotIdForCode(r.flockLot.code));
                setSelectedMort(r);
                setModal('edit');
              }}
            />,
          ])}
          page={mortPag.page}
          totalPages={mortPag.totalPages}
          total={mortPag.total}
          onPage={mortPag.setPage}
        />
      ) : null}

      {tab === 'racao' ? (
        <PaginatedTable
          headers={['Data', 'Lote', 'Consumido (kg)', 'Status', 'Ações']}
          recordItems={feedPag.slice}
          rows={feedPag.slice.map((r) => [
            formatCalendarDatePtBR(r.date),
            r.flockLot.code,
            r.consumedKg,
            <RecordStatusBadge key={`${r.id}-st`} status={r.status ?? 'RECORDED'} />,
            <RowActions
              key={r.id}
              onView={() => {
                setSelectedFeed(r);
                setViewOpen(true);
              }}
              onEdit={() => {
                setLotId(lotIdForCode(r.flockLot.code));
                setSelectedFeed(r);
                setModal('edit');
              }}
            />,
          ])}
          page={feedPag.page}
          totalPages={feedPag.totalPages}
          total={feedPag.total}
          onPage={feedPag.setPage}
        />
      ) : null}

      {tab === 'ambiente' ? (
        <PaginatedTable
          headers={['Data', 'Galpão', 'Temp °C', 'Umidade %', 'Ações']}
          recordItems={envPag.slice}
          rows={envPag.slice.map((r) => [
            new Date(r.recordedAt).toLocaleString('pt-BR'),
            r.barn.code,
            r.temperatureC ?? '—',
            r.humidityPct ?? '—',
            <RowActions
              key={r.id}
              onView={() => {
                setSelectedEnv(r);
                setViewOpen(true);
              }}
            />,
          ])}
          page={envPag.page}
          totalPages={envPag.totalPages}
          total={envPag.total}
          onPage={envPag.setPage}
        />
      ) : null}

      {tab === 'transferencia' ? (
        <PaginatedTable
          headers={['Data', 'Origem', 'Destino', 'Kg', 'Ações']}
          recordItems={trPag.slice}
          rows={trPag.slice.map((r) => [
            formatCalendarDatePtBR(r.date),
            r.fromLot.code,
            r.toLot.code,
            r.quantityKg,
            <RowActions
              key={r.id}
              onView={() => {
                setSelectedTransfer(r);
                setViewOpen(true);
              }}
            />,
          ])}
          page={trPag.page}
          totalPages={trPag.totalPages}
          total={trPag.total}
          onPage={trPag.setPage}
        />
      ) : null}

      <FormCadastroModal
        open={formOpen}
        onClose={() => setModal(null)}
        title={formTitle}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form={formId}>
              Salvar
            </Button>
          </>
        }
      >
        {(modal === 'include' || modal === 'edit') && tab === 'postura' ? (
          <form id="egg-form" onSubmit={submitEgg} key={editingEgg?.id ?? 'egg-new'}>
            {lotSelect}
            <Field label="Data">
              <input
                name="date"
                type="date"
                className={inputClass}
                defaultValue={editingEgg ? dateInputValue(editingEgg.date) : today}
                required
              />
            </Field>
            <p className="-mt-2 mb-3 text-xs text-slate-500">
              Um lançamento por lote e data. Incluir de novo na mesma data substitui o registro anterior.
            </p>
            {EGG_PRODUCTION_FIELDS.map((f) => (
              <Field key={f} label={labelEggProductionField(f)}>
                <input
                  name={f}
                  type="number"
                  min={0}
                  className={inputClass}
                  defaultValue={editingEgg ? (editingEgg[f] ?? 0) : 0}
                />
              </Field>
            ))}
            <Field label="Peso médio (g)">
              <input
                name="avgEggWeightG"
                type="number"
                step="0.1"
                className={inputClass}
                defaultValue={editingEgg?.avgEggWeightG ?? ''}
              />
            </Field>
            <Field label="Motivo do descarte (quando houver)">
              <input name="discardReason" className={inputClass} defaultValue={editingEgg?.discardReason ?? ''} />
            </Field>
            <Field label="Turno (opcional)">
              <input name="shift" className={inputClass} defaultValue={editingEgg?.shift ?? ''} placeholder="Manhã / Tarde" />
            </Field>
            {editingEgg ? <ReasonField locked={isRecordLocked(editingEgg.status)} /> : null}
          </form>
        ) : null}

        {(modal === 'include' || modal === 'edit') && tab === 'mortalidade' ? (
          <form id="mort-form" onSubmit={submitMortality} key={editingMort?.id ?? 'mort-new'}>
            {lotSelect}
            <Field label="Data">
              <input
                name="date"
                type="date"
                className={inputClass}
                defaultValue={editingMort ? dateInputValue(editingMort.date) : today}
                required
              />
            </Field>
            <p className="-mt-2 mb-3 text-xs text-slate-500">
              Vários lançamentos no mesmo dia são permitidos (cada Incluir cria um novo registro).
            </p>
            <Field label="Quantidade">
              <input
                name="quantity"
                type="number"
                min={0}
                className={inputClass}
                required
                defaultValue={editingMort?.quantity ?? ''}
              />
            </Field>
            <Field label="Causa (registrada — não confirma diagnóstico)">
              <select name="cause" className={inputClass} defaultValue={editingMort?.cause ?? 'UNKNOWN'}>
                {MORTALITY_CAUSES.map((c) => (
                  <option key={c} value={c}>
                    {labelEnum(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observação">
              <input name="causeNotes" className={inputClass} defaultValue={editingMort?.causeNotes ?? ''} />
            </Field>
            <Field label="Turno (opcional)">
              <input name="shift" className={inputClass} defaultValue={editingMort?.shift ?? ''} placeholder="Manhã / Tarde" />
            </Field>
            {editingMort ? <ReasonField locked={isRecordLocked(editingMort.status)} /> : null}
          </form>
        ) : null}

        {(modal === 'include' || modal === 'edit') && tab === 'racao' ? (
          <form id="feed-form" onSubmit={submitFeed} key={editingFeed?.id ?? 'feed-new'}>
            {lotSelect}
            <Field label="Data">
              <input
                name="date"
                type="date"
                className={inputClass}
                defaultValue={editingFeed ? dateInputValue(editingFeed.date) : today}
                required
              />
            </Field>
            <p className="-mt-2 mb-3 text-xs text-slate-500">
              Um lançamento por lote e data. Incluir de novo na mesma data substitui o registro anterior.
            </p>
            <Field label="Consumido (kg)">
              <input
                name="consumedKg"
                type="number"
                step="0.001"
                min={0}
                className={inputClass}
                required
                defaultValue={editingFeed?.consumedKg ?? ''}
              />
            </Field>
            <Field label="Sobra (kg)">
              <input
                name="leftoverKg"
                type="number"
                step="0.001"
                min={0}
                className={inputClass}
                defaultValue={editingFeed?.leftoverKg ?? 0}
              />
            </Field>
            <Field label="Produto de estoque (ração) — opcional">
              <select name="productId" className={inputClass} defaultValue={editingFeed?.productId ?? ''}>
                <option value="">— não vincular ao estoque —</option>
                {feedProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Local de estoque (opcional)">
              <select name="stockLocationId" className={inputClass} defaultValue={editingFeed?.stockLocationId ?? ''}>
                <option value="">—</option>
                {stockLocations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <p className="-mt-2 mb-3 text-xs text-slate-500">
              Com produto vinculado, a baixa no estoque é feita automaticamente após a conferência (ou no registro, conforme configuração).
            </p>
            <Field label="Turno (opcional)">
              <input name="shift" className={inputClass} defaultValue={editingFeed?.shift ?? ''} placeholder="Manhã / Tarde" />
            </Field>
            {editingFeed ? <ReasonField locked={isRecordLocked(editingFeed.status)} /> : null}
          </form>
        ) : null}

        {modal === 'include' && tab === 'ambiente' ? (
          <form id="env-form" onSubmit={submitEnvironmental}>
            <Field label="Galpão">
              <select className={inputClass} value={barnId} onChange={(e) => setBarnId(e.target.value)}>
                {barns.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Temperatura (°C)">
              <input name="temperatureC" type="number" step="0.1" className={inputClass} />
            </Field>
            <Field label="Umidade (%)">
              <input name="humidityPct" type="number" step="0.1" min={0} max={100} className={inputClass} />
            </Field>
            <Field label="Ventilação / observação">
              <input name="ventilationNote" className={inputClass} />
            </Field>
          </form>
        ) : null}

        {modal === 'include' && tab === 'transferencia' ? (
          <form id="transfer-form" onSubmit={submitTransfer}>
            <Field label="Lote origem">
              <select className={inputClass} value={lotId} onChange={(e) => setLotId(e.target.value)}>
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Lote destino">
              <select
                className={inputClass}
                value={transferToLotId}
                onChange={(e) => setTransferToLotId(e.target.value)}
              >
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Data">
              <input name="date" type="date" className={inputClass} defaultValue={today} required />
            </Field>
            <Field label="Quantidade (kg)">
              <input name="quantityKg" type="number" step="0.001" min={0} className={inputClass} required />
            </Field>
            <Field label="Observação">
              <input name="notes" className={inputClass} />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Detalhe do lançamento"
        sections={
          tab === 'postura' && selectedEgg
            ? [
                {
                  title: 'Postura',
                  fields: [
                    { label: 'Data', value: formatCalendarDatePtBR(selectedEgg.date) },
                    { label: 'Lote', value: selectedEgg.flockLot.code },
                    { label: 'Comerciais (un)', value: eggCommercialQty(selectedEgg) },
                    { label: 'Extra', value: selectedEgg.extra },
                    { label: 'Grande', value: selectedEgg.large },
                    { label: 'Médio', value: selectedEgg.medium },
                    { label: 'Pequeno', value: selectedEgg.small },
                    { label: 'Trincados', value: selectedEgg.cracked ?? 0 },
                    { label: 'Sujos', value: selectedEgg.dirty ?? 0 },
                    { label: 'Deformados', value: selectedEgg.deformed ?? 0 },
                    { label: 'Descarte', value: selectedEgg.discard ?? 0 },
                    { label: 'Motivo do descarte', value: selectedEgg.discardReason ?? '—' },
                    { label: 'Peso médio (g)', value: selectedEgg.avgEggWeightG ?? '—' },
                    { label: 'Observações', value: selectedEgg.notes ?? '—' },
                  ],
                },
                { title: 'Registro e conferência', fields: recordMetaFields(selectedEgg) },
                {
                  title: 'Histórico de alterações',
                  content: <RecordHistorySection entity="DailyEggProduction" id={selectedEgg.id} />,
                },
              ]
            : tab === 'mortalidade' && selectedMort
              ? [
                  {
                    title: 'Mortalidade',
                    fields: [
                      { label: 'Data', value: formatCalendarDatePtBR(selectedMort.date) },
                      { label: 'Lote', value: selectedMort.flockLot.code },
                      { label: 'Quantidade', value: selectedMort.quantity },
                      { label: 'Causa registrada', value: labelEnum(selectedMort.cause ?? 'UNKNOWN') },
                      { label: 'Obs.', value: selectedMort.causeNotes ?? '—' },
                    ],
                  },
                  { title: 'Registro e conferência', fields: recordMetaFields(selectedMort) },
                  {
                    title: 'Histórico de alterações',
                    content: <RecordHistorySection entity="DailyMortality" id={selectedMort.id} />,
                  },
                ]
              : tab === 'racao' && selectedFeed
                ? [
                    {
                      title: 'Ração',
                      fields: [
                        { label: 'Data', value: formatCalendarDatePtBR(selectedFeed.date) },
                        { label: 'Lote', value: selectedFeed.flockLot.code },
                        { label: 'Consumido (kg)', value: selectedFeed.consumedKg },
                        { label: 'Sobra (kg)', value: selectedFeed.leftoverKg },
                        {
                          label: 'Produto de estoque',
                          value: selectedFeed.product ? `${selectedFeed.product.sku} — ${selectedFeed.product.name}` : '—',
                        },
                      ],
                    },
                    { title: 'Registro e conferência', fields: recordMetaFields(selectedFeed) },
                    {
                      title: 'Histórico de alterações',
                      content: <RecordHistorySection entity="DailyFeedConsumption" id={selectedFeed.id} />,
                    },
                  ]
                : tab === 'ambiente' && selectedEnv
                  ? [
                      {
                        title: 'Ambiente',
                        fields: [
                          {
                            label: 'Galpão',
                            value: `${selectedEnv.barn.code} — ${selectedEnv.barn.name}`,
                          },
                          {
                            label: 'Registro',
                            value: new Date(selectedEnv.recordedAt).toLocaleString('pt-BR'),
                          },
                          { label: 'Temperatura (°C)', value: selectedEnv.temperatureC ?? '—' },
                          { label: 'Umidade (%)', value: selectedEnv.humidityPct ?? '—' },
                          { label: 'Ventilação', value: selectedEnv.ventilationNote ?? '—' },
                        ],
                      },
                    ]
                  : tab === 'transferencia' && selectedTransfer
                    ? [
                        {
                          title: 'Transferência',
                          fields: [
                            { label: 'Data', value: formatCalendarDatePtBR(selectedTransfer.date) },
                            { label: 'Origem', value: selectedTransfer.fromLot.code },
                            { label: 'Destino', value: selectedTransfer.toLot.code },
                            { label: 'Quantidade (kg)', value: selectedTransfer.quantityKg },
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
        wide
      >
        <ProductionReportLauncher
          domain={tab}
          lots={lots}
          returnHref={tab === 'postura' ? '/producao' : `/producao?tab=${tab}`}
        />
      </ModuleReportsModal>
    </AdminShell>
  );
}
