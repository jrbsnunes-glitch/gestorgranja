'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FilterControlRangeFields,
  FilterProductGroupField,
} from '@/components/crud/filter-fields';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  CrudListChrome,
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  RowRecordActions,
  useCrudList,
} from '@/components/crud';
import { ProductGroupPicker, type ProductGroup } from '@/components/product-group-picker';
import { ProductsReportLauncher } from '@/components/products-report-launcher';
import { PaginatedTable, usePagination } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum, PRODUCT_TYPES } from '@/lib/labels';
import { formatBrl, formatPct } from '@/lib/money';

type Fiscal = { id: string; code: string; description: string; isActive?: boolean };
type PriceHistoryRow = {
  id: string;
  salePrice: number;
  previousPrice: number | null;
  recordedAt: string;
  source: string;
};

type Product = {
  id: string;
  controlNumber?: number;
  sku: string;
  name: string;
  description: string | null;
  type: string;
  unit: string;
  minStockQty: number;
  groupId: string | null;
  group: ProductGroup | null;
  salePrice: number | null;
  averageCost: number;
  profit: number | null;
  profitMarginPct: number | null;
  ncm: string | null;
  fiscalOrigin: string | null;
  fiscalCst: string | null;
  fiscalSituationId: string | null;
  fiscalSituation: Fiscal | null;
};

type ProductListFilters = {
  groupId: string;
  controlMin: string;
  controlMax: string;
};

const EMPTY_PRODUCT_FILTERS: ProductListFilters = {
  groupId: '',
  controlMin: '',
  controlMax: '',
};

function productFiltersActive(f: ProductListFilters) {
  return Boolean(f.groupId || f.controlMin.trim() || f.controlMax.trim());
}

function matchesProductFilters(p: Product, f: ProductListFilters) {
  if (f.groupId && p.groupId !== f.groupId) return false;
  const control = p.minStockQty;
  if (f.controlMin.trim()) {
    const min = Number(f.controlMin.replace(',', '.'));
    if (Number.isFinite(min) && control < min) return false;
  }
  if (f.controlMax.trim()) {
    const max = Number(f.controlMax.replace(',', '.'));
    if (Number.isFinite(max) && control > max) return false;
  }
  return true;
}

function profitPreview(salePrice: string, averageCost: number) {
  const sale = salePrice.trim() === '' ? null : Number(salePrice.replace(',', '.'));
  if (sale == null || !Number.isFinite(sale)) return { profit: null as number | null, pct: null as number | null };
  const profit = sale - averageCost;
  const pct = sale > 0 ? (profit / sale) * 100 : null;
  return { profit, pct };
}

export default function ProdutosPage() {
  const [rows, setRows] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [fiscal, setFiscal] = useState<Fiscal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [groupId, setGroupId] = useState('');
  const [salePriceInput, setSalePriceInput] = useState('');
  const [priceHistory, setPriceHistory] = useState<PriceHistoryRow[]>([]);
  const [productFilterDraft, setProductFilterDraft] = useState<ProductListFilters>(EMPTY_PRODUCT_FILTERS);
  const [productFilterApplied, setProductFilterApplied] = useState<ProductListFilters>(EMPTY_PRODUCT_FILTERS);

  const list = useCrudList({
    items: rows,
    searchFields: (p) => [
      String(p.controlNumber ?? ''),
      p.sku,
      p.name,
      p.description,
      p.type,
      p.ncm,
      p.group?.name,
    ],
    extraFilter: (p) => matchesProductFilters(p, productFilterApplied),
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Product[]>('/v1/inventory/products').then(setRows);
    void apiFetch<ProductGroup[]>('/v1/inventory/product-groups').then(setGroups);
    void apiFetch<Fiscal[]>('/v1/cadastros/general/fiscal-situations').then(setFiscal);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (list.filterOpen) setProductFilterDraft(productFilterApplied);
  }, [list.filterOpen, productFilterApplied]);

  const fiscalActive = useMemo(() => fiscal.filter((f) => f.isActive !== false), [fiscal]);

  const formAverageCost = editMode && selected ? selected.averageCost : 0;
  const liveProfit = useMemo(
    () => profitPreview(salePriceInput, formAverageCost),
    [salePriceInput, formAverageCost],
  );

  function resetFormState(p: Product | null) {
    setGroupId(p?.groupId ?? '');
    setSalePriceInput(p?.salePrice != null ? String(p.salePrice) : '');
  }

  function openInclude() {
    setSelected(null);
    setEditMode(false);
    resetFormState(null);
    setFormOpen(true);
    setError(null);
  }

  function openEdit(p: Product) {
    setSelected(p);
    setEditMode(true);
    resetFormState(p);
    setFormOpen(true);
    setError(null);
  }

  async function openView(p: Product) {
    setSelected(p);
    setViewOpen(true);
    setPriceHistory([]);
    try {
      const hist = await apiFetch<PriceHistoryRow[]>(`/v1/inventory/products/${p.id}/price-history`);
      setPriceHistory(hist);
    } catch {
      setPriceHistory([]);
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const fiscalSituationId = String(fd.get('fiscalSituationId') || '');
    const saleRaw = String(fd.get('salePrice') ?? '').trim();
    const salePrice = saleRaw === '' ? null : Number(saleRaw.replace(',', '.'));

    const payload = {
      name: fd.get('name'),
      description: String(fd.get('description') || '') || null,
      groupId: groupId || null,
      unit: fd.get('unit') || 'UN',
      minStockQty: Number(fd.get('minStockQty') ?? 0),
      salePrice: salePrice != null && Number.isFinite(salePrice) ? salePrice : null,
      ncm: String(fd.get('ncm') || '') || null,
      fiscalOrigin: String(fd.get('fiscalOrigin') || '') || null,
      fiscalCst: String(fd.get('fiscalCst') || '') || null,
      fiscalSituationId: fiscalSituationId || null,
    };

    try {
      if (editMode && selected) {
        await apiFetch(`/v1/inventory/products/${selected.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/v1/inventory/products', {
          method: 'POST',
          body: JSON.stringify({
            sku: fd.get('sku'),
            type: fd.get('type'),
            ...payload,
            groupId: groupId || undefined,
            fiscalSituationId: fiscalSituationId || undefined,
            ncm: payload.ncm || undefined,
            fiscalOrigin: payload.fiscalOrigin || undefined,
            fiscalCst: payload.fiscalCst || undefined,
          }),
        });
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Produtos">
      <PageIntro
        title="Produtos e materiais"
        description="Catálogo de ração, medicamentos, insumos e ovos embalados."
      />
      <ErrorBox message={error} />
      <PageCard>
        <CrudListChrome
          list={list}
          onInclude={openInclude}
          onReports={() => setReportsOpen(true)}
          searchPlaceholder="SKU, nome, grupo, NCM…"
          filtersActive={list.filtersActive || productFiltersActive(productFilterApplied)}
          onFilterApply={() => setProductFilterApplied(productFilterDraft)}
          onFilterClear={() => {
            setProductFilterDraft(EMPTY_PRODUCT_FILTERS);
            setProductFilterApplied(EMPTY_PRODUCT_FILTERS);
          }}
          filterExtra={
            <div className="mt-3 grid gap-3">
              <FilterProductGroupField
                idPrefix="produtos"
                groupId={productFilterDraft.groupId}
                groups={groups}
                onGroupIdChange={(id) => setProductFilterDraft((d) => ({ ...d, groupId: id }))}
              />
              <FilterControlRangeFields
                idPrefix="produtos"
                controlMin={productFilterDraft.controlMin}
                controlMax={productFilterDraft.controlMax}
                onControlMinChange={(v) => setProductFilterDraft((d) => ({ ...d, controlMin: v }))}
                onControlMaxChange={(v) => setProductFilterDraft((d) => ({ ...d, controlMax: v }))}
                minLabel="Controle mínimo (est. mín.) de"
                maxLabel="Controle máximo (est. mín.) até"
              />
              <p className="text-xs text-slate-500">
                Filtra pelo estoque mínimo cadastrado no produto. Deixe em branco para ignorar.
              </p>
            </div>
          }
        />
        <PaginatedTable
          headers={['SKU', 'Nome', 'Grupo', 'Est. mín.', 'Preço venda', 'Custo médio', 'Lucro', 'Ações']}
          recordItems={slice}
          rows={slice.map((p) => [
            p.sku,
            p.name,
            p.group?.name ?? '—',
            p.minStockQty.toLocaleString('pt-BR', { maximumFractionDigits: 3 }),
            formatBrl(p.salePrice),
            formatBrl(p.averageCost),
            p.profit != null ? `${formatBrl(p.profit)} (${formatPct(p.profitMarginPct)})` : '—',
            <RowRecordActions key={p.id} onView={() => openView(p)} onEdit={() => openEdit(p)} />,
          ])}
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
        />
      </PageCard>

      <FormCadastroModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editMode ? 'Alterar produto' : 'Incluir produto'}
        size="xl"
        dense
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="product-form">
              Salvar
            </Button>
          </>
        }
      >
        <form
          id="product-form"
          onSubmit={save}
          key={selected?.id ?? 'new'}
          className="grid grid-cols-1 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 [&_label.block]:mb-0.5 [&_label.block]:text-xs [&_label.block_span]:mb-0.5"
        >
          {!editMode ? (
            <>
              <Field label="SKU">
                <input name="sku" className={inputClass} required />
              </Field>
              <Field label="Tipo">
                <select name="type" className={inputClass} required>
                  {PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {labelEnum(t)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unidade">
                <input name="unit" className={inputClass} defaultValue="UN" />
              </Field>
            </>
          ) : (
            <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 sm:col-span-2 lg:col-span-3">
              SKU <strong className="text-slate-900">{selected?.sku}</strong> · Tipo{' '}
              <strong className="text-slate-900">{labelEnum(selected?.type)}</strong> · Un.{' '}
              <strong className="text-slate-900">{selected?.unit}</strong>
            </div>
          )}

          <div className="sm:col-span-2 lg:col-span-2">
            <Field label="Nome">
              <input name="name" className={inputClass} required defaultValue={selected?.name} />
            </Field>
          </div>

          <Field label="Estoque mínimo">
            <input
              name="minStockQty"
              type="number"
              min={0}
              step="0.001"
              className={inputClass}
              defaultValue={selected?.minStockQty ?? 0}
            />
          </Field>

          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Descrição">
              <textarea
                name="description"
                rows={2}
                className={`${inputClass} min-h-0 resize-y py-1.5`}
                defaultValue={selected?.description ?? ''}
                placeholder="Detalhes, embalagem, observações…"
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <ProductGroupPicker
              groups={groups}
              groupId={groupId}
              onGroupIdChange={setGroupId}
              onGroupCreated={(g) =>
                setGroups((prev) => [...prev, g].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
              }
            />
          </div>

          <Field label="Situação fiscal">
            <select name="fiscalSituationId" className={inputClass} defaultValue={selected?.fiscalSituationId ?? ''}>
              <option value="">—</option>
              {fiscalActive.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.code} — {f.description}
                </option>
              ))}
            </select>
          </Field>

          <Field label="NCM">
            <input name="ncm" className={inputClass} defaultValue={selected?.ncm ?? ''} />
          </Field>
          <Field label="Origem fiscal">
            <input name="fiscalOrigin" className={inputClass} defaultValue={selected?.fiscalOrigin ?? ''} />
          </Field>
          <Field label="CST">
            <input name="fiscalCst" className={inputClass} defaultValue={selected?.fiscalCst ?? ''} />
          </Field>

          <Field label="Preço de venda (R$)">
            <input
              name="salePrice"
              type="number"
              min={0}
              step="0.01"
              className={inputClass}
              value={salePriceInput}
              onChange={(e) => setSalePriceInput(e.target.value)}
              placeholder="0,00"
            />
          </Field>

          <Field label="Custo médio (calculado)">
            <input
              className={`${inputClass} bg-slate-50`}
              readOnly
              value={formatBrl(formAverageCost)}
              tabIndex={-1}
              title="Média móvel das movimentações de estoque com custo informado"
            />
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              Calculado pelas movimentações. Compras:{' '}
              <strong className="font-medium text-slate-700">Estoque → Entradas (NF)</strong>. Ovos da postura:{' '}
              <strong className="font-medium text-slate-700">Estoque → Integração postura</strong> (custo por ovo
              comercial).
            </p>
          </Field>

          <Field label="Lucro (unitário)">
            <input
              className={`${inputClass} bg-slate-50`}
              readOnly
              value={
                liveProfit.profit != null
                  ? `${formatBrl(liveProfit.profit)} · ${formatPct(liveProfit.pct)}`
                  : '—'
              }
              tabIndex={-1}
            />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar produto"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Identificação',
                  fields: [
                    { label: 'Controle', value: selected.controlNumber ?? '—' },
                    { label: 'SKU', value: selected.sku },
                    { label: 'Nome', value: selected.name },
                    { label: 'Descrição', value: selected.description ?? '—' },
                    { label: 'Grupo', value: selected.group?.name ?? '—' },
                    { label: 'Tipo', value: labelEnum(selected.type) },
                    { label: 'Unidade', value: selected.unit },
                    { label: 'Estoque mínimo', value: selected.minStockQty },
                    {
                      label: 'Situação fiscal',
                      value: selected.fiscalSituation
                        ? `${selected.fiscalSituation.code} — ${selected.fiscalSituation.description}`
                        : '—',
                    },
                    { label: 'NCM', value: selected.ncm ?? '—' },
                    { label: 'Origem fiscal', value: selected.fiscalOrigin ?? '—' },
                    { label: 'CST', value: selected.fiscalCst ?? '—' },
                  ],
                },
                {
                  title: 'Preços',
                  fields: [
                    { label: 'Preço de venda', value: formatBrl(selected.salePrice) },
                    { label: 'Custo médio', value: formatBrl(selected.averageCost) },
                    {
                      label: 'Lucro unitário',
                      value:
                        selected.profit != null
                          ? `${formatBrl(selected.profit)} (${formatPct(selected.profitMarginPct)})`
                          : '—',
                    },
                  ],
                },
                {
                  title: 'Histórico de preços de venda',
                  fields:
                    priceHistory.length === 0
                      ? [{ label: 'Registros', value: 'Nenhuma alteração registrada ainda.' }]
                      : priceHistory.slice(0, 8).map((h) => ({
                          label: new Date(h.recordedAt).toLocaleString('pt-BR'),
                          value: `${formatBrl(h.salePrice)}${
                            h.previousPrice != null ? ` (antes: ${formatBrl(h.previousPrice)})` : ''
                          } · ${h.source === 'create' ? 'cadastro' : 'alteração'}`,
                        })),
                },
              ]
            : []
        }
      />

      <ModuleReportsModal
        open={reportsOpen}
        title="Produtos e materiais"
        onClose={() => setReportsOpen(false)}
        compactLauncher
        wide
      >
        <ProductsReportLauncher returnHref="/produtos" />
      </ModuleReportsModal>
    </AdminShell>
  );
}
