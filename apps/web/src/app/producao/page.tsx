'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
  type RecordViewField,
} from '@/components/crud';
import { RECORD_VIEW_EGG_ICON } from '@/components/crud/record-view-presentation';
import { ProductionReportLauncher } from '@/components/production-report-launcher';
import {
  ListToolbar,
  PaginatedTable,
  RowActions,
  TabBar,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { RecordStatusBadge } from '@/components/operation/record-status-badge';
import { ProductLookupField } from '@/components/product-lookup-field';
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

function eggPostureViewFields(row: EggRow): RecordViewField[] {
  const eggIcon = RECORD_VIEW_EGG_ICON;
  return [
    { label: 'Data', value: formatCalendarDatePtBR(row.date) },
    { label: 'Lote', value: row.flockLot.code },
    { label: 'Comerciais (un)', value: eggCommercialQty(row), icon: eggIcon },
    ...EGG_PRODUCTION_FIELDS.map((f) => ({
      label: labelEggProductionField(f),
      value: row[f] ?? 0,
      icon: eggIcon,
    })),
    { label: 'Motivo do descarte', value: row.discardReason ?? '—', icon: eggIcon },
    { label: 'Peso médio (g)', value: row.avgEggWeightG ?? '—', icon: eggIcon },
    { label: 'Observações', value: row.notes ?? '—' },
  ];
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

const AUX_TABS: { id: TabId; label: string }[] = [
  { id: 'racao', label: 'Ração' },
  { id: 'ambiente', label: 'Ambiente' },
  { id: 'transferencia', label: 'Transferência' },
];

function producaoPageCopy(tab: TabId) {
  if (tab === 'mortalidade') {
    return {
      shell: 'Mortalidade',
      title: 'Registrar mortalidade',
      description: 'Preencha o formulário acima e use Salvar mortalidade. O histórico aparece na lista abaixo.',
    };
  }
  if (tab === 'racao' || tab === 'ambiente' || tab === 'transferencia') {
    const label = AUX_TABS.find((t) => t.id === tab)?.label ?? tab;
    return {
      shell: `Produção — ${label}`,
      title: `Lançamentos — ${label}`,
      description: 'Postura e mortalidade ficam no menu acima (Produção / Mortalidade).',
    };
  }
  return {
    shell: 'Produção',
    title: 'Registrar produção',
    description: 'Preencha o formulário acima e use Salvar produção. Ração, ambiente e transferência nos links abaixo.',
  };
}

function parseProducaoTab(raw: string | null): TabId {
  if (raw && TAB_IDS.includes(raw as TabId)) return raw as TabId;
  return 'postura';
}

function formFieldString(fd: FormData, name: string): string {
  const v = fd.get(name);
  if (v == null) return '';
  return String(v).trim();
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const [notice, setNotice] = useState<string | null>(null);
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
    searchFields: (r) => [r.flockLot?.code, r.causeNotes],
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
  const [quickKey, setQuickKey] = useState(0);
  const mortEditIdRef = useRef<string | null>(null);
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
    setNotice(null);
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
    setNotice(null);
    const formEl = e.currentTarget;
    const formDomId = formEl.id;
    const fd = new FormData(formEl);
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
      setQuickKey((k) => k + 1);
      if (formDomId !== 'egg-form') {
        setNotice('Produção registrada com sucesso.');
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitMortality(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const formEl = e.currentTarget;
    const formDomId = formEl.id;
    const fd = new FormData(formEl);
    try {
      const flockLotId = formFieldString(fd, 'flockLotId') || lotId;
      if (!flockLotId) {
        setError('Selecione o lote.');
        return;
      }
      const body = {
        flockLotId,
        date: fd.get('date'),
        quantity: Number(fd.get('quantity')),
        cause: fd.get('cause') || undefined,
        causeNotes: fd.get('causeNotes') || undefined,
        shift: fd.get('shift') || undefined,
        reason: fd.get('reason') || undefined,
      };
      const recordId =
        formFieldString(fd, '_recordId') || mortEditIdRef.current || editingMort?.id || '';
      const isEdit = UUID_RE.test(recordId);
      if (isEdit) {
        await apiFetch(`/v1/production/daily-mortality/${recordId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch('/v1/production/daily-mortality', {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      mortEditIdRef.current = null;
      setModal(null);
      setSelectedMort(null);
      setQuickKey((k) => k + 1);
      if (formDomId !== 'mort-form') {
        setNotice('Mortalidade registrada com sucesso.');
      }
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

  const quickEntryTab = tab === 'postura' || tab === 'mortalidade';
  const formOpen =
    (modal === 'include' && !quickEntryTab) ||
    (modal === 'edit' &&
      ((tab === 'postura' && selectedEgg != null) ||
        (tab === 'mortalidade' && selectedMort != null) ||
        (tab === 'racao' && selectedFeed != null)));

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
      <select
        name="flockLotId"
        className={inputClass}
        value={lotId}
        onChange={(e) => setLotId(e.target.value)}
        required
      >
        {lots.map((l) => (
          <option key={l.id} value={l.id}>
            {l.code} — {l.barn.name}
          </option>
        ))}
      </select>
    </Field>
  );

  function closeFormModal() {
    setModal(null);
    mortEditIdRef.current = null;
    if (tab === 'postura') setSelectedEgg(null);
    if (tab === 'mortalidade') setSelectedMort(null);
    if (tab === 'racao') setSelectedFeed(null);
  }

  const copy = producaoPageCopy(tab);

  return (
    <AdminShell title={copy.shell}>
      <PageIntro title={copy.title} description={copy.description} />
      <ErrorBox message={error} />
      {notice ? (
        <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
          {notice}
        </p>
      ) : null}
      {tab === 'postura' && !modal ? (
        <section className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/producao/ovo.svg" alt="" className="h-10 w-10" />
            <div>
              <h2 className="text-base font-semibold text-emerald-950">Registrar produção</h2>
              <p className="text-xs text-slate-600">Quantidades por classe de ovo. Um lançamento por lote e data.</p>
            </div>
          </div>
          <form key={`egg-quick-${quickKey}`} onSubmit={submitEgg} className="grid gap-3 md:grid-cols-2">
            {lotSelect}
            <Field label="Data">
              <input name="date" type="date" className={inputClass} defaultValue={today} required />
            </Field>
            <div className="grid grid-cols-2 gap-3 md:col-span-2 md:grid-cols-4">
              {EGG_PRODUCTION_FIELDS.map((f) => (
                <Field key={f} label={labelEggProductionField(f)}>
                  <input name={f} type="number" min={0} className={inputClass} defaultValue={0} />
                </Field>
              ))}
            </div>
            <Field label="Peso médio (g)">
              <input name="avgEggWeightG" type="number" step="0.1" className={inputClass} />
            </Field>
            <Field label="Observações">
              <input name="discardReason" className={inputClass} placeholder="Descarte, comportamento, coleta…" />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit">Salvar produção</Button>
            </div>
          </form>
        </section>
      ) : null}
      {tab === 'mortalidade' && !modal ? (
        <section className="mb-4 rounded-xl border border-rose-100 bg-rose-50/50 p-4">
          <div className="mb-3 flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/producao/silhueta-galinha-erp.png" alt="" className="h-10 w-10 object-contain" />
            <div>
              <h2 className="text-base font-semibold text-rose-950">Registrar mortalidade</h2>
              <p className="text-xs text-slate-600">O saldo de aves do lote é atualizado com este lançamento.</p>
            </div>
          </div>
          <form key={`mort-quick-${quickKey}`} onSubmit={submitMortality} className="grid gap-3 md:grid-cols-2">
            {lotSelect}
            <Field label="Data">
              <input name="date" type="date" className={inputClass} defaultValue={today} required />
            </Field>
            <Field label="Quantidade de mortes">
              <input name="quantity" type="number" min={0} className={inputClass} required />
            </Field>
            <Field label="Causa">
              <select name="cause" className={inputClass} defaultValue="UNKNOWN">
                {MORTALITY_CAUSES.map((c) => (
                  <option key={c} value={c}>
                    {labelEnum(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Observações">
              <input name="causeNotes" className={inputClass} placeholder="Sinais, tratamento, local…" />
            </Field>
            <div className="md:col-span-2">
              <Button type="submit">Salvar mortalidade</Button>
            </div>
          </form>
        </section>
      ) : null}
      {tab === 'postura' || tab === 'mortalidade' ? (
        <p className="mb-3 text-sm text-slate-600">
          Outros lançamentos:{' '}
          {AUX_TABS.map((t, i) => (
            <span key={t.id}>
              {i > 0 ? ' · ' : null}
              <Link href={`/producao?tab=${t.id}`} className="font-medium text-emerald-800 underline-offset-2 hover:underline">
                {t.label}
              </Link>
            </span>
          ))}
        </p>
      ) : (
        <TabBar active={tab} onChange={(id) => setProducaoTab(id as TabId)} tabs={AUX_TABS} />
      )}

      <ListToolbar
        list={activeList}
        onInclude={
          quickEntryTab
            ? undefined
            : tab === 'ambiente' || tab === 'transferencia'
              ? () => setModal('include')
              : openInclude
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
            r.flockLot?.code ?? '—',
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
                setError(null);
                setViewOpen(false);
                if (!r.id || !UUID_RE.test(r.id)) {
                  setError('Não foi possível abrir o registro (identificador ausente). Recarregue a lista.');
                  return;
                }
                if (!r.flockLot?.code) {
                  setError('Registro sem lote associado.');
                  return;
                }
                mortEditIdRef.current = r.id;
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
        onClose={closeFormModal}
        title={formTitle}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeFormModal}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => document.getElementById(formId)?.requestSubmit()}
            >
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
            {editingMort?.id ? <input type="hidden" name="_recordId" value={editingMort.id} /> : null}
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
            <ProductLookupField
              name="productId"
              label="Produto de estoque (ração) — opcional"
              allowEmpty
              defaultValue={editingFeed?.productId ?? ''}
              placeholder="— não vincular ao estoque —"
            />
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
                { title: 'Postura', fields: eggPostureViewFields(selectedEgg) },
                { title: 'Registro e conferência', fields: recordMetaFields(selectedEgg) },
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
        auditTrail={
          tab === 'postura' && selectedEgg
            ? { entity: 'DailyEggProduction', entityId: selectedEgg.id }
            : tab === 'mortalidade' && selectedMort
              ? { entity: 'DailyMortality', entityId: selectedMort.id }
              : tab === 'racao' && selectedFeed
                ? { entity: 'DailyFeedConsumption', entityId: selectedFeed.id }
                : null
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
