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
import { ListToolbar, PaginatedTable, RowActions, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { StockReceiptsReportLauncher } from '@/components/stock-receipts-report-launcher';
import { apiFetch } from '@/lib/api';

type Partner = { id: string; name: string };
type Product = { id: string; sku: string; name: string };
type StockLoc = { id: string; code: string; name: string };
type Receipt = {
  id: string;
  invoiceNumber: string | null;
  nfeAccessKey: string | null;
  receivedAt: string;
  totalAmount: string;
  partner: { name: string };
  stockLocation: { code: string } | null;
};

export default function EntradasEstoquePage() {
  const [rows, setRows] = useState<Receipt[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [locais, setLocais] = useState<StockLoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [selected, setSelected] = useState<Receipt | null>(null);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [r.partner.name, r.invoiceNumber, r.nfeAccessKey, r.stockLocation?.code],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Receipt[]>('/v1/inventory/stock-receipts').then(setRows);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
    void apiFetch<Product[]>('/v1/inventory/products').then(setProducts);
    void apiFetch<StockLoc[]>('/v1/cadastros/general/stock-locations').then(setLocais);
  }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const nfeKey = String(fd.get('nfeAccessKey') || '').trim();
    try {
      await apiFetch('/v1/inventory/stock-receipts', {
        method: 'POST',
        body: JSON.stringify({
          partnerId: fd.get('partnerId'),
          invoiceNumber: fd.get('invoiceNumber') || undefined,
          invoiceSeries: fd.get('invoiceSeries') || undefined,
          issuedAt: fd.get('issuedAt') || undefined,
          nfeAccessKey: nfeKey || undefined,
          mode: nfeKey ? 'NFE_KEY' : 'MANUAL',
          stockLocationId: fd.get('stockLocationId') || undefined,
          chartAccountId: fd.get('chartAccountId') || undefined,
          notes: fd.get('notes') || undefined,
          items: [
            {
              productId: fd.get('productId'),
              quantity: Number(fd.get('quantity')),
              unitCost: Number(fd.get('unitCost')),
              batchCode: fd.get('batchCode') || undefined,
            },
          ],
        }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Entradas de estoque (NF)">
      <PageIntro
        title="Entradas por nota fiscal"
        description="Registro de recebimentos de mercadoria com NF manual ou chave NFe."
      />
      <ErrorBox message={error} />
      <PageCard title="Notas de entrada">
        <ListToolbar
          list={list}
          onInclude={() => setModal('include')}
          onReports={() => setReportsOpen(true)}
          searchPlaceholder="Parceiro, NF, chave…"
        />
        <PaginatedTable
          headers={['Recebido', 'Parceiro', 'NF', 'Chave NFe', 'Local', 'Total', 'Ações']}
          recordItems={slice}
          rows={slice.map((r) => [
            new Date(r.receivedAt).toLocaleString('pt-BR'),
            r.partner.name,
            r.invoiceNumber ?? '—',
            r.nfeAccessKey ? `${r.nfeAccessKey.slice(0, 8)}…` : '—',
            r.stockLocation?.code ?? '—',
            `R$ ${Number(r.totalAmount).toFixed(2)}`,
            <RowActions
              key={r.id}
              onView={() => {
                setSelected(r);
                setViewOpen(true);
              }}
            />,
          ])}
          page={page}
          totalPages={totalPages}
          total={total}
          onPage={setPage}
        />
      </PageCard>

      <FormCadastroModal
        open={modal === 'include'}
        onClose={() => setModal(null)}
        title="Entrada por NF"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setModal(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="receipt-form">
              Registrar entrada
            </Button>
          </>
        }
      >
        <form id="receipt-form" onSubmit={save} className="grid md:grid-cols-2 md:gap-x-4">
          <Field label="Fornecedor">
            <select name="partnerId" className={inputClass} required>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Número NF">
            <input name="invoiceNumber" className={inputClass} />
          </Field>
          <Field label="Série">
            <input name="invoiceSeries" className={inputClass} />
          </Field>
          <Field label="Emissão NF">
            <input name="issuedAt" type="date" className={inputClass} />
          </Field>
          <Field label="Chave de acesso NFe">
            <input name="nfeAccessKey" className={inputClass} placeholder="44 dígitos (opcional)" />
          </Field>
          <Field label="Local de estoque">
            <select name="stockLocationId" className={inputClass}>
              <option value="">Padrão</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code} — {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Conta contábil (estoque)">
            <ChartAccountSelect flow="stock" allowEmpty emptyLabel="Automático (padrão)" />
          </Field>
          <Field label="Produto">
            <select name="productId" className={inputClass} required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quantidade">
            <input name="quantity" type="number" step="0.001" min={0} className={inputClass} required />
          </Field>
          <Field label="Custo unitário">
            <input name="unitCost" type="number" step="0.0001" min={0} className={inputClass} required />
          </Field>
          <Field label="Lote">
            <input name="batchCode" className={inputClass} />
          </Field>
          <Field label="Observações">
            <input name="notes" className={inputClass} />
          </Field>
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewOpen}
        onClose={() => setViewOpen(false)}
        title="Visualizar entrada"
        wide
        sections={
          selected
            ? [
                {
                  title: 'Nota',
                  fields: [
                    { label: 'Recebido em', value: new Date(selected.receivedAt).toLocaleString('pt-BR') },
                    { label: 'Fornecedor', value: selected.partner.name },
                    { label: 'Número NF', value: selected.invoiceNumber },
                    { label: 'Chave NFe', value: selected.nfeAccessKey },
                    { label: 'Local', value: selected.stockLocation?.code },
                    { label: 'Total', value: `R$ ${Number(selected.totalAmount).toFixed(2)}` },
                  ],
                },
              ]
            : []
        }
      />

      <ModuleReportsModal
        open={reportsOpen}
        title="Entradas de estoque"
        onClose={() => setReportsOpen(false)}
        compactLauncher
        wide
      >
        <StockReceiptsReportLauncher returnHref="/estoque/entradas" />
      </ModuleReportsModal>
    </AdminShell>
  );
}
