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
import { ListToolbar, PaginatedTable, RowActions, TabBar, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { StockMovementsReportLauncher } from '@/components/stock-movements-report-launcher';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';

type Product = { id: string; sku: string; name: string; type: string; unit: string };
type Movement = {
  id: string;
  type: string;
  quantity: string;
  movedAt: string;
  partnerName?: string | null;
  product: { sku: string; name: string };
  chartAccount: { code: string; name: string };
};

type EggStockConfig = {
  enabled: boolean;
  eggsPerCarton: number;
  cartonsPerBox: number;
  syncCartons: boolean;
  syncBoxes: boolean;
  cartonProductId: string | null;
  boxProductId: string | null;
  chartAccountId: string | null;
  costPerCommercialEgg: string | number | null;
};

export default function EstoquePage() {
  const [tab, setTab] = useState('movimentos');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [eggConfig, setEggConfig] = useState<EggStockConfig | null>(null);
  const [resyncMsg, setResyncMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selectedMove, setSelectedMove] = useState<Movement | null>(null);

  const movList = useCrudList({
    items: movements,
    searchFields: (m) => [m.product.sku, m.product.name, m.type, m.chartAccount.code],
  });
  const movPag = usePagination(movList.filtered);
  const packagedEggs = products.filter((p) => p.type === 'PACKAGED_EGG');

  const load = useCallback(() => {
    void apiFetch<Product[]>('/v1/inventory/products').then(setProducts);
    void apiFetch<Movement[]>('/v1/inventory/movements').then(setMovements);
    void apiFetch<EggStockConfig>('/v1/production/egg-stock-config').then(setEggConfig);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/inventory/movements', {
        method: 'POST',
        body: JSON.stringify({
          productId: fd.get('productId'),
          chartAccountId: fd.get('chartAccountId'),
          type: fd.get('type'),
          quantity: Number(fd.get('quantity')),
          unitCost: fd.get('unitCost') ? Number(fd.get('unitCost')) : undefined,
          reference: fd.get('reference') || undefined,
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function saveEggConfig(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setResyncMsg(null);
    const fd = new FormData(e.currentTarget);
    const carton = fd.get('cartonProductId');
    const box = fd.get('boxProductId');
    const chartAccountId = fd.get('chartAccountId');
    try {
      const updated = await apiFetch<EggStockConfig>('/v1/production/egg-stock-config', {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: fd.get('enabled') === 'on',
          eggsPerCarton: Number(fd.get('eggsPerCarton')),
          cartonsPerBox: Number(fd.get('cartonsPerBox')),
          syncCartons: fd.get('syncCartons') === 'on',
          syncBoxes: fd.get('syncBoxes') === 'on',
          cartonProductId: carton ? String(carton) : null,
          boxProductId: box ? String(box) : null,
          chartAccountId: chartAccountId ? String(chartAccountId) : null,
          costPerCommercialEgg: (() => {
            const raw = String(fd.get('costPerCommercialEgg') ?? '').trim();
            if (!raw) return null;
            const n = Number(raw.replace(',', '.'));
            return Number.isFinite(n) ? n : null;
          })(),
        }),
      });
      setEggConfig(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar integração');
    }
  }

  async function applyEggProductionCosts() {
    setError(null);
    setResyncMsg(null);
    try {
      const r = await apiFetch<{ updated: number; cartonUnitCost?: number | null; boxUnitCost?: number | null }>(
        '/v1/production/egg-stock-config/apply-costs',
        { method: 'POST' },
      );
      setResyncMsg(
        r.updated > 0
          ? `Custo aplicado em ${r.updated} entrada(s) da postura.`
          : 'Nenhuma entrada da postura pendente de custo (ou configure o custo por ovo).',
      );
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar custos');
    }
  }

  async function resyncEggStock() {
    setError(null);
    setResyncMsg(null);
    try {
      const r = await apiFetch<{ processed: number }>('/v1/production/egg-stock-config/resync', {
        method: 'POST',
      });
      setResyncMsg(`Reprocessadas ${r.processed} posturas.`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao reprocessar');
    }
  }

  return (
    <AdminShell title="Estoque">
      <PageIntro
        title="Estoque"
        description="Movimentações manuais e integração automática da postura diária com produtos embalados."
      />
      <ErrorBox message={error} />
      {resyncMsg ? <p className="mb-3 text-sm text-emerald-700">{resyncMsg}</p> : null}
      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'movimentos', label: 'Movimentações' },
          { id: 'postura', label: 'Integração postura' },
        ]}
      />

      {tab === 'movimentos' ? (
        <PageCard title="Movimentações">
          <ListToolbar
            list={movList}
            onInclude={() => {
              setSelectedMove(null);
              setModal('include');
            }}
            onReports={() => setReportsOpen(true)}
            searchPlaceholder="Produto, tipo, conta…"
          />
          <PaginatedTable
            headers={['Data', 'Produto', 'Conta contábil', 'Tipo', 'Qtd', 'Ações']}
            recordItems={movPag.slice}
            rows={movPag.slice.map((m) => [
              new Date(m.movedAt).toLocaleString('pt-BR'),
              `${m.product.sku} — ${m.product.name}`,
              `${m.chartAccount.code}`,
              labelEnum(m.type),
              m.quantity,
              <RowActions
                key={m.id}
                onView={() => {
                  setSelectedMove(m);
                  setViewOpen(true);
                }}
              />,
            ])}
            page={movPag.page}
            totalPages={movPag.totalPages}
            total={movPag.total}
            onPage={movPag.setPage}
          />
        </PageCard>
      ) : (
        <PageCard title="Integração postura → estoque">
          <p className="mb-4 text-sm text-zinc-600">
            Ao salvar a postura diária, ovos comerciais (extra + grande + médio + pequeno) geram entradas de
            estoque em cartelas e caixas. Informe o <strong>custo por ovo comercial</strong> para alimentar o custo
            médio dos produtos embalados (média móvel no estoque).
          </p>
          {eggConfig ? (
            <form onSubmit={saveEggConfig} className="max-w-xl space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input name="enabled" type="checkbox" defaultChecked={eggConfig.enabled} />
                Integração ativa
              </label>
              <Field label="Ovos por cartela">
                <input
                  name="eggsPerCarton"
                  type="number"
                  min={1}
                  className={inputClass}
                  defaultValue={eggConfig.eggsPerCarton}
                  required
                />
              </Field>
              <Field label="Cartelas por caixa">
                <input
                  name="cartonsPerBox"
                  type="number"
                  min={1}
                  className={inputClass}
                  defaultValue={eggConfig.cartonsPerBox}
                  required
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input name="syncCartons" type="checkbox" defaultChecked={eggConfig.syncCartons} />
                Lançar estoque de cartelas
              </label>
              <Field label="Produto cartela">
                <select name="cartonProductId" className={inputClass} defaultValue={eggConfig.cartonProductId ?? ''}>
                  <option value="">—</option>
                  {packagedEggs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input name="syncBoxes" type="checkbox" defaultChecked={eggConfig.syncBoxes} />
                Lançar estoque de caixas
              </label>
              <Field label="Produto caixa">
                <select name="boxProductId" className={inputClass} defaultValue={eggConfig.boxProductId ?? ''}>
                  <option value="">—</option>
                  {packagedEggs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Conta contábil (estoque)">
                <ChartAccountSelect flow="stock" defaultValue={eggConfig.chartAccountId ?? ''} required />
              </Field>
              <Field label="Custo por ovo comercial (R$)">
                <input
                  name="costPerCommercialEgg"
                  type="number"
                  min={0}
                  step="0.0001"
                  className={inputClass}
                  defaultValue={
                    eggConfig.costPerCommercialEgg != null && eggConfig.costPerCommercialEgg !== ''
                      ? Number(eggConfig.costPerCommercialEgg)
                      : ''
                  }
                  placeholder="Ex.: 0,35 (produção + rateio)"
                />
              </Field>
              <p className="text-xs text-zinc-500">
                Cartela ≈ custo/ovo × ovos/cartela · Caixa ≈ custo cartela × cartelas/caixa. A postura lança
                cartelas avulsas (resto) e caixas fechadas, sem duplicar estoque. Após alterar regras, use
                Reprocessar posturas no estoque.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit">Salvar configuração</Button>
                <Button type="button" variant="secondary" onClick={() => void applyEggProductionCosts()}>
                  Aplicar custo às entradas já lançadas
                </Button>
                <Button type="button" variant="secondary" onClick={() => void resyncEggStock()}>
                  Reprocessar posturas no estoque
                </Button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-zinc-500">Carregando…</p>
          )}
        </PageCard>
      )}

      <FormCadastroModal
        open={modal === 'include'}
        onClose={() => setModal(null)}
        title="Incluir movimento"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="movement-form">
              Lançar movimento
            </Button>
          </>
        }
      >
        <form id="movement-form" onSubmit={saveMovement}>
          <Field label="Produto">
            <select name="productId" className={inputClass} required>
              <option value="">Selecione</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Conta contábil">
            <ChartAccountSelect flow="stock" required />
          </Field>
          <Field label="Tipo">
            <select name="type" className={inputClass} required>
              <option value="IN">Entrada</option>
              <option value="OUT">Saída</option>
              <option value="ADJUST">Ajuste</option>
            </select>
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" step="0.001" min={0} className={inputClass} required />
          </Field>
          <Field label="Custo unitário">
            <input name="unitCost" type="number" step="0.0001" className={inputClass} />
          </Field>
          <Field label="Referência">
            <input name="reference" className={inputClass} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar movimento"
        wide
        sections={
          selectedMove
            ? [
                {
                  title: 'Lançamento',
                  fields: [
                    { label: 'Data', value: new Date(selectedMove.movedAt).toLocaleString('pt-BR') },
                    {
                      label: 'Produto',
                      value: `${selectedMove.product.sku} — ${selectedMove.product.name}`,
                    },
                    {
                      label: 'Conta contábil',
                      value: `${selectedMove.chartAccount.code} — ${selectedMove.chartAccount.name}`,
                    },
                    { label: 'Tipo', value: labelEnum(selectedMove.type) },
                    ...(selectedMove.type === 'OUT'
                      ? [{ label: 'Cliente', value: selectedMove.partnerName ?? '—' }]
                      : []),
                    { label: 'Quantidade', value: selectedMove.quantity },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal
        open={reportsOpen}
        title="Estoque"
        onClose={() => setReportsOpen(false)}
        compactLauncher
        wide
      >
        <StockMovementsReportLauncher returnHref="/estoque" />
      </ModuleReportsModal>
    </AdminShell>
  );
}
