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
  Modal,
  PaginatedTable,
  RowActions,
  TabBar,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { PartnerSearchField } from '@/components/partner-search-field';
import { PurchaseOrdersReportLauncher } from '@/components/purchase-orders-report-launcher';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';

type Product = { id: string; sku: string; name: string; unit: string };
type StockLocation = { id: string; code: string; name: string };
type Partner = { id: string; name: string; isSupplier?: boolean };

type RequestItem = {
  id: string;
  productId: string;
  quantity: string;
  product: Product;
};

type Quote = {
  id: string;
  supplierName: string;
  totalAmount: string;
  selected: boolean;
  partnerId?: string | null;
};

type OrderItem = {
  productId: string;
  quantity: string;
  unitPrice: string;
  product: Product;
};

type Request = {
  id: string;
  controlNumber: number;
  code: string;
  description: string;
  status: string;
  items: RequestItem[];
  quotes: Quote[];
  order: {
    id: string;
    orderNumber: string;
    payablesGenerated?: boolean;
    items?: OrderItem[];
  } | null;
};

type LineDraft = { productId: string; quantity: string };

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Itens e cotações só enquanto não houver pedido gerado. */
function canEditRequest(r: Request) {
  if (r.status === 'RECEIVED' || r.status === 'CANCELLED') return false;
  return !r.order?.id;
}

function ItemsTable({ items }: { items: RequestItem[] }) {
  if (!items.length) {
    return <p className="text-sm text-amber-800">Nenhum produto na requisição.</p>;
  }
  return (
    <table className="mb-3 w-full border-collapse text-sm">
      <thead>
        <tr className="border-b text-left text-slate-600">
          <th className="py-1 pr-2">Produto</th>
          <th className="py-1 text-right">Qtd</th>
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={i.id} className="border-b border-slate-100">
            <td className="py-1 pr-2">
              {i.product.sku} — {i.product.name}
            </td>
            <td className="py-1 text-right tabular-nums">
              {Number(i.quantity).toFixed(3)} {i.product.unit}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ComprasPage() {
  const [tab, setTab] = useState('lista');
  const [rows, setRows] = useState<Request[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockLocations, setStockLocations] = useState<StockLocation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Request | null>(null);
  const [impactMsg, setImpactMsg] = useState<string | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [orderQuotePreview, setOrderQuotePreview] = useState<string>('');
  const [newLines, setNewLines] = useState<LineDraft[]>([{ productId: '', quantity: '1' }]);
  const [editLines, setEditLines] = useState<LineDraft[]>([]);
  const [quotePrices, setQuotePrices] = useState<Record<string, string>>({});

  const suppliers = useMemo(
    () => partners.filter((p) => p.isSupplier).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [partners],
  );

  const quoteTotalPreview = useMemo(() => {
    if (!selected?.items.length) return 0;
    let sum = 0;
    for (const i of selected.items) {
      const price = Number(quotePrices[i.productId] ?? 0);
      sum += Number(i.quantity) * price;
    }
    return Math.round(sum * 100) / 100;
  }, [selected?.items, quotePrices]);

  const winningQuotePartnerId = useMemo(() => {
    if (!selected) return '';
    const win = selected.quotes.find((q) => q.selected) ?? selected.quotes[0];
    return win?.partnerId ?? '';
  }, [selected]);

  useEffect(() => {
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
    void apiFetch<Product[]>('/v1/inventory/products').then(setProducts);
    void apiFetch<StockLocation[]>('/v1/cadastros/general/stock-locations').then(setStockLocations);
  }, []);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [String(r.controlNumber), r.code, r.description, r.status, r.order?.orderNumber],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Request[]>('/v1/purchasing/requests').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openEdit(req: Request) {
    setSelected(req);
    setQuoteSupplierId('');
    setQuotePrices({});
    setEditLines(
      req.items.length
        ? req.items.map((i) => ({ productId: i.productId, quantity: String(Number(i.quantity)) }))
        : [{ productId: products[0]?.id ?? '', quantity: '1' }],
    );
    setModal('edit');
  }

  async function saveRequestItems() {
    if (!selected) return;
    setError(null);
    const items = editLines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (!items.length) {
      setError('Informe ao menos um produto.');
      return;
    }
    try {
      await apiFetch(`/v1/purchasing/requests/${selected.id}/items`, {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
      const fresh = await apiFetch<Request[]>('/v1/purchasing/requests');
      setRows(fresh);
      const updated = fresh.find((r) => r.id === selected.id) ?? null;
      setSelected(updated);
      if (updated) {
        setEditLines(
          updated.items.map((i) => ({ productId: i.productId, quantity: String(Number(i.quantity)) })),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function createRequest(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const items = newLines
      .filter((l) => l.productId && Number(l.quantity) > 0)
      .map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
    if (!items.length) {
      setError('Adicione ao menos um produto cadastrado.');
      return;
    }
    try {
      await apiFetch('/v1/purchasing/requests', {
        method: 'POST',
        body: JSON.stringify({
          code: fd.get('code'),
          description: fd.get('description'),
          items,
        }),
      });
      setModal(null);
      setNewLines([{ productId: '', quantity: '1' }]);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function addQuote(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected?.items.length) {
      setError('Salve os itens da requisição antes de cotar.');
      return;
    }
    const supplier = suppliers.find((p) => p.id === quoteSupplierId);
    if (!supplier) {
      setError('Selecione um fornecedor cadastrado.');
      return;
    }
    const fd = new FormData(e.currentTarget);
    const total = quoteTotalPreview;
    const quoteItems = selected.items.map((i) => ({
      productId: i.productId,
      unitPrice: Number(quotePrices[i.productId] ?? 0),
    }));
    const dueDate = String(fd.get('dueDate') || new Date().toISOString().slice(0, 10));
    const installments = Math.max(1, Number(fd.get('installments') || 1));
    const part = Math.round((total / installments) * 100) / 100;
    const paymentTermsJson = Array.from({ length: installments }, (_, i) => {
      const d = new Date(dueDate + 'T12:00:00');
      d.setMonth(d.getMonth() + i);
      return {
        amount: i === installments - 1 ? total - part * (installments - 1) : part,
        dueDate: d.toISOString().slice(0, 10),
      };
    });
    try {
      await apiFetch(`/v1/purchasing/requests/${selected.id}/quotes`, {
        method: 'POST',
        body: JSON.stringify({
          supplierName: supplier.name,
          partnerId: supplier.id,
          totalAmount: total,
          items: quoteItems,
          paymentTermsJson,
        }),
      });
      const fresh = await apiFetch<Request[]>('/v1/purchasing/requests');
      setRows(fresh);
      setSelected(fresh.find((r) => r.id === selected.id) ?? null);
      setQuoteSupplierId('');
      setQuotePrices({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function previewQuoteImpact(quoteId: string) {
    if (!quoteId) {
      setImpactMsg(null);
      return;
    }
    try {
      const impact = await apiFetch<{ highImpact: boolean; totalImpact: number }>(
        `/v1/finance/cash-impact/purchase-quote/${quoteId}`,
      );
      setImpactMsg(
        impact.highImpact
          ? `Atenção: impacto elevado (R$ ${impact.totalImpact.toFixed(2)}) sobre caixa projetado.`
          : `Impacto estimado: R$ ${impact.totalImpact.toFixed(2)}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao simular impacto');
    }
  }

  async function createOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) return;
    const fd = new FormData(e.currentTarget);
    const quoteId = String(fd.get('quoteId'));
    try {
      const impact = await apiFetch<{ highImpact: boolean; totalImpact: number }>(
        `/v1/finance/cash-impact/purchase-quote/${quoteId}`,
      );
      setImpactMsg(
        impact.highImpact
          ? `Atenção: impacto elevado (R$ ${impact.totalImpact.toFixed(2)}) sobre caixa projetado.`
          : `Impacto estimado: R$ ${impact.totalImpact.toFixed(2)}.`,
      );
      if (
        impact.highImpact &&
        !window.confirm(
          `Impacto elevado no fluxo (R$ ${impact.totalImpact.toFixed(2)}). Confirmar geração do pedido mesmo assim?`,
        )
      ) {
        return;
      }
      await apiFetch(`/v1/purchasing/requests/${selected.id}/order`, {
        method: 'POST',
        body: JSON.stringify({
          quoteId,
          orderNumber: fd.get('orderNumber'),
          financeApproved: fd.get('financeApproved') === 'on',
          highImpact: impact.highImpact,
        }),
      });
      setModal(null);
      setImpactMsg(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function generatePayables(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected?.order?.id) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    try {
      await apiFetch(`/v1/finance/purchase-orders/${selected.order.id}/generate-payables`, {
        method: 'POST',
        body: JSON.stringify({
          partnerId: fd.get('partnerId'),
          chartAccountId: fd.get('chartAccountId'),
        }),
      });
      load();
      const fresh = await apiFetch<Request[]>('/v1/purchasing/requests');
      setRows(fresh);
      setSelected(fresh.find((r) => r.id === selected.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function receiveOrder(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected?.order?.id) return;
    const fd = new FormData(e.currentTarget);
    setError(null);
    try {
      await apiFetch(`/v1/purchasing/orders/${selected.order.id}/receive`, {
        method: 'POST',
        body: JSON.stringify({
          notes: fd.get('notes') || 'Recebimento via painel web',
          partnerId: fd.get('partnerId'),
          stockLocationId: fd.get('stockLocationId') || undefined,
          chartAccountId: fd.get('chartAccountId') || undefined,
        }),
      });
      setViewOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  function renderLineEditors(
    lines: LineDraft[],
    setLines: (v: LineDraft[]) => void,
    idPrefix: string,
  ) {
    return (
      <div className="mb-3 space-y-2">
        <p className="text-sm font-medium text-slate-800">Itens (produtos cadastrados)</p>
        {lines.map((line, idx) => (
          <div key={`${idPrefix}-${idx}`} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1">
              <label className="mb-1 block text-xs text-slate-600">Produto</label>
              <select
                className={inputClass}
                value={line.productId}
                onChange={(ev) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], productId: ev.target.value };
                  setLines(next);
                }}
                required
              >
                <option value="">Selecione…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="mb-1 block text-xs text-slate-600">Quantidade</label>
              <input
                type="number"
                step="0.001"
                min={0.001}
                className={inputClass}
                value={line.quantity}
                onChange={(ev) => {
                  const next = [...lines];
                  next[idx] = { ...next[idx], quantity: ev.target.value };
                  setLines(next);
                }}
                required
              />
            </div>
            {lines.length > 1 ? (
              <Button
                type="button"
                variant="secondary"
                className="mb-0.5 text-xs"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                Remover
              </Button>
            ) : null}
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          className="text-sm"
          onClick={() => setLines([...lines, { productId: products[0]?.id ?? '', quantity: '1' }])}
        >
          + Linha
        </Button>
        {products.length === 0 ? (
          <p className="text-xs text-amber-800">Cadastre produtos em Produtos / Estoque antes de comprar.</p>
        ) : null}
      </div>
    );
  }

  return (
    <AdminShell title="Compras (requisição → cotação → pedido → recebimento)">
      <PageIntro
        title="Compras"
        description="Requisição com produtos do cadastro, cotação por item, pedido e entrada automática no estoque ao receber."
      />
      <ErrorBox message={error} />
      {impactMsg ? <p className="mb-3 text-sm text-amber-800">{impactMsg}</p> : null}
      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'lista', label: 'Requisições' },
          { id: 'ajuda', label: 'Fluxo' },
        ]}
      />

      {tab === 'lista' ? (
        <PageCard title="Pipeline de compras">
          <ListToolbar
            list={list}
            onInclude={() => {
              setNewLines([{ productId: products[0]?.id ?? '', quantity: '1' }]);
              setModal('include');
            }}
            onReports={() => setReportsOpen(true)}
            searchPlaceholder="Código, descrição, status…"
          />
          <PaginatedTable
            headers={['Controle', 'Código', 'Descrição', 'Itens', 'Status', 'Cotações', 'Pedido', 'Ações']}
            recordItems={slice}
            rows={slice.map((r) => [
              r.controlNumber,
              r.code,
              r.description,
              String(r.items?.length ?? 0),
              labelEnum(r.status),
              String(r.quotes.length),
              r.order?.orderNumber ?? '—',
              <RowActions
                key={r.id}
                editLabel="Editar"
                onView={() => {
                  setSelected(r);
                  setViewOpen(true);
                }}
                onEdit={canEditRequest(r) ? () => openEdit(r) : undefined}
              />,
            ])}
            page={page}
            totalPages={totalPages}
            total={total}
            onPage={setPage}
          />
        </PageCard>
      ) : (
        <PageCard title="Etapas">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-slate-700">
            <li>Incluir requisição com um ou mais produtos cadastrados (SKU, quantidade).</li>
            <li>Editar → ajustar itens se necessário; adicionar cotações com preço unitário por produto.</li>
            <li>Escolher cotação vencedora e gerar pedido (itens vão para o pedido).</li>
            <li>Visualizar → receber: gera entrada de estoque e movimentação IN por produto.</li>
          </ol>
        </PageCard>
      )}

      <FormCadastroModal
        open={modal === 'include'}
        onClose={() => setModal(null)}
        title="Incluir requisição"
        size="lg"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="request-form">
              Criar requisição
            </Button>
          </>
        }
      >
        <form id="request-form" onSubmit={createRequest}>
          <Field label="Código">
            <input name="code" className={inputClass} required placeholder="REQ-2026-001" />
          </Field>
          <Field label="Descrição">
            <textarea name="description" className={inputClass} rows={2} required />
          </Field>
          {renderLineEditors(newLines, setNewLines, 'new')}
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar requisição"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Requisição',
                  fields: [
                    { label: 'Código', value: selected.code },
                    { label: 'Descrição', value: selected.description },
                    { label: 'Status', value: labelEnum(selected.status) },
                    { label: 'Pedido', value: selected.order?.orderNumber },
                    {
                      label: 'Cotações',
                      value:
                        selected.quotes.map((q) => `${q.supplierName}: R$ ${q.totalAmount}`).join(' | ') || '—',
                    },
                  ],
                },
              ]
            : []
        }
      >
        {selected && !canEditRequest(selected) && (selected.items?.length ?? 0) === 0 ? (
          <p className="mb-3 text-sm text-amber-800">
            Requisição sem produtos e com pedido já gerado ou encerrada — inclua uma nova requisição para comprar por
            item cadastrado.
          </p>
        ) : null}
        {selected && canEditRequest(selected) ? (
          <div className="mb-4">
            <Button
              type="button"
              onClick={() => {
                setViewOpen(false);
                openEdit(selected);
              }}
            >
              Editar requisição (itens e cotações)
            </Button>
          </div>
        ) : null}
        {selected ? (
          <>
            <ItemsTable items={selected.items ?? []} />
            {selected.order?.items?.length ? (
              <div className="mb-4">
                <p className="mb-1 text-sm font-medium text-slate-800">Itens do pedido</p>
                <ul className="text-sm text-slate-700">
                  {selected.order.items.map((i) => (
                    <li key={i.productId}>
                      {i.product.sku} — {Number(i.quantity).toFixed(3)} {i.product.unit} × R${' '}
                      {Number(i.unitPrice).toFixed(4)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
        {selected?.order && selected.status !== 'RECEIVED' ? (
          <form onSubmit={receiveOrder} className="mt-4 space-y-3 border-t pt-4">
            <p className="text-sm font-medium text-slate-800">Recebimento e entrada no estoque</p>
            <Field label="Fornecedor (parceiro)">
              <select name="partnerId" className={inputClass} required defaultValue={winningQuotePartnerId}>
                <option value="">Selecione…</option>
                {suppliers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Local de estoque (opcional)">
              <select name="stockLocationId" className={inputClass} defaultValue="">
                <option value="">Padrão / sem local</option>
                {stockLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.code} — {l.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Conta contábil estoque (opcional)">
              <ChartAccountSelect name="chartAccountId" flow="stock" allowEmpty emptyLabel="Conta padrão do sistema" />
            </Field>
            <Field label="Observações">
              <input name="notes" className={inputClass} placeholder="Conferência, NF…" />
            </Field>
            <SubmitButton label="Confirmar recebimento" />
          </form>
        ) : selected?.status === 'RECEIVED' ? (
          <p className="mt-4 text-sm text-emerald-800">Recebimento registrado — estoque atualizado.</p>
        ) : null}
        {selected?.order && !selected.order.payablesGenerated ? (
          <form onSubmit={generatePayables} className="mt-6 space-y-3 border-t pt-4">
            <p className="text-sm font-medium text-slate-800">Gerar contas a pagar (opcional)</p>
            <Field label="Fornecedor (parceiro)">
              <select name="partnerId" className={inputClass} required defaultValue={winningQuotePartnerId}>
                <option value="">Selecione…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Conta contábil">
              <ChartAccountSelect name="chartAccountId" flow="payable" required />
            </Field>
            <SubmitButton label="Gerar CP do pedido" />
          </form>
        ) : selected?.order?.payablesGenerated ? (
          <p className="mt-4 text-sm text-emerald-800">Contas a pagar já geradas para este pedido.</p>
        ) : null}
      </RecordViewModal>

      <Modal
        title="Editar requisição (cotação / pedido)"
        open={modal === 'edit'}
        onClose={() => {
          setModal(null);
          setQuoteSupplierId('');
        }}
        wide
      >
        {selected && !selected.order ? (
          <>
            <p className="mb-3 text-sm text-slate-600">{selected.description}</p>
            {renderLineEditors(editLines, setEditLines, 'edit')}
            <Button type="button" className="mb-4 text-sm" onClick={() => void saveRequestItems()}>
              Salvar itens da requisição
            </Button>
            <ItemsTable items={selected.items ?? []} />
            {selected.quotes.length > 0 ? (
              <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-sm font-medium text-slate-800">Cotações registradas ({selected.quotes.length})</p>
                <ul className="space-y-1 text-sm text-slate-700">
                  {selected.quotes.map((q) => (
                    <li key={q.id}>
                      {q.supplierName} — R$ {Number(q.totalAmount).toFixed(2)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {selected.items.length > 0 ? (
              <>
                <p className="mb-2 text-sm font-medium text-slate-800">
                  {selected.quotes.length > 0 ? 'Adicionar outra cotação' : 'Primeira cotação'}
                </p>
                <form onSubmit={addQuote}>
                  <PartnerSearchField
                    partners={suppliers}
                    partnerId={quoteSupplierId}
                    label="Fornecedor"
                    placeholder="Pesquisar no cadastro de fornecedores…"
                    onPartnerIdChange={setQuoteSupplierId}
                  />
                  <div className="my-3 rounded-md border border-slate-200 p-3">
                    <p className="mb-2 text-xs font-medium text-slate-700">Preço unitário por produto</p>
                    {selected.items.map((i) => (
                      <div key={i.id} className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          {i.product.sku} — {Number(i.quantity).toFixed(3)} {i.product.unit}
                        </span>
                        <input
                          type="number"
                          step="0.0001"
                          min={0}
                          className={`${inputClass} w-32`}
                          placeholder="R$ unit."
                          value={quotePrices[i.productId] ?? ''}
                          onChange={(ev) =>
                            setQuotePrices((prev) => ({ ...prev, [i.productId]: ev.target.value }))
                          }
                          required
                        />
                      </div>
                    ))}
                    <p className="text-sm font-medium text-slate-800">Total: {money(quoteTotalPreview)}</p>
                  </div>
                  <Field label="1º vencimento">
                    <input name="dueDate" type="date" className={inputClass} required />
                  </Field>
                  <Field label="Parcelas">
                    <input name="installments" type="number" min={1} max={24} defaultValue={1} className={inputClass} />
                  </Field>
                  <SubmitButton label={selected.quotes.length > 0 ? 'Adicionar cotação' : 'Salvar cotação'} />
                </form>
              </>
            ) : (
              <p className="text-sm text-amber-800">Salve os itens antes de cotar.</p>
            )}
            {selected.quotes.length > 0 ? (
              <form onSubmit={createOrder} className="mt-6 border-t pt-4">
                <Field label="Cotação vencedora">
                  <select
                    name="quoteId"
                    className={inputClass}
                    required
                    value={orderQuotePreview || selected.quotes[0]?.id || ''}
                    onChange={(ev) => {
                      setOrderQuotePreview(ev.target.value);
                      void previewQuoteImpact(ev.target.value);
                    }}
                  >
                    {selected.quotes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.supplierName} — R$ {q.totalAmount}
                      </option>
                    ))}
                  </select>
                </Field>
                {impactMsg ? <p className="mb-2 text-sm text-amber-800">{impactMsg}</p> : null}
                <Button
                  type="button"
                  variant="secondary"
                  className="mb-3"
                  onClick={() => void previewQuoteImpact(orderQuotePreview || selected.quotes[0]?.id || '')}
                >
                  Simular impacto financeiro
                </Button>
                <Field label="Nº pedido">
                  <input name="orderNumber" className={inputClass} required placeholder="PC-2026-001" />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="financeApproved" />
                  Aprovação financeira
                </label>
                <SubmitButton label="Gerar pedido" />
              </form>
            ) : null}
          </>
        ) : null}
      </Modal>

      <ModuleReportsModal
        open={reportsOpen}
        title="Compras"
        onClose={() => setReportsOpen(false)}
        compactLauncher
        wide
      >
        <PurchaseOrdersReportLauncher returnHref="/compras" />
      </ModuleReportsModal>
    </AdminShell>
  );
}
