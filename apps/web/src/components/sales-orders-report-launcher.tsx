'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import {
  FilterControlRangeFields,
  FilterPeriodRangeFields,
} from '@/components/crud/filter-fields';
import { PartnerSearchField } from '@/components/partner-search-field';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import {
  defaultSalesOrdersReportFilters,
  openSalesOrdersReportPrint,
  SALES_ORDERS_REPORT_VARIANTS,
  type SalesOrdersReportFilters,
  type SalesOrdersReportVariant,
} from '@/lib/sales-orders-report-query';

type Partner = { id: string; name: string; tradeName?: string | null };
type Product = { id: string; sku: string; name: string };
type OrderPick = { id: string; controlNumber: number; partner: { name: string }; orderDate: string };

export function SalesOrdersReportLauncher({
  returnHref,
  initialSalesOrderId,
}: {
  returnHref?: string;
  initialSalesOrderId?: string;
}) {
  const [filters, setFilters] = useState<SalesOrdersReportFilters>(() =>
    defaultSalesOrdersReportFilters(initialSalesOrderId ? 'espelho' : 'periodo'),
  );
  const [partners, setPartners] = useState<Partner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderPick[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
    void apiFetch<Product[]>('/v1/inventory/products').then(setProducts);
    void apiFetch<OrderPick[]>('/v1/commercial/orders').then(setRecentOrders);
  }, []);

  useEffect(() => {
    if (initialSalesOrderId) {
      setFilters((f) => ({
        ...f,
        variant: 'espelho',
        salesOrderId: initialSalesOrderId,
      }));
    }
  }, [initialSalesOrderId]);

  function patch(partial: Partial<SalesOrdersReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function setVariant(variant: SalesOrdersReportVariant) {
    setFilters((f) => ({ ...f, variant, salesOrderId: variant === 'espelho' ? f.salesOrderId : '' }));
    setError(null);
  }

  function generate() {
    if (filters.variant === 'espelho') {
      const hasOrder = Boolean(filters.salesOrderId.trim());
      const singleControl =
        filters.controlMin.trim() &&
        (!filters.controlMax.trim() || filters.controlMin.trim() === filters.controlMax.trim());
      if (!hasOrder && !singleControl) {
        setError('Selecione a venda na lista, escolha abaixo ou informe o número de controle.');
        return;
      }
    }
    setError(null);
    openSalesOrdersReportPrint(filters, returnHref);
  }

  const selectedOrder = recentOrders.find((o) => o.id === filters.salesOrderId);

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          {SALES_ORDERS_REPORT_VARIANTS.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="sales-orders-report-variant"
                className="mt-1"
                checked={filters.variant === v.id}
                onChange={() => setVariant(v.id)}
              />
              <span>
                <span className="font-medium">{v.label}</span>
                <span className="block text-xs text-slate-500">{v.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {filters.variant === 'espelho' ? (
        <>
          <Field label="Venda (espelho)">
            <select
              className={inputClass}
              value={filters.salesOrderId}
              onChange={(e) => patch({ salesOrderId: e.target.value, controlMin: '', controlMax: '' })}
            >
              <option value="">— Selecione ou use controle abaixo —</option>
              {recentOrders.map((o) => (
                <option key={o.id} value={o.id}>
                  Controle {o.controlNumber} · {o.partner.name} ·{' '}
                  {new Date(o.orderDate).toLocaleDateString('pt-BR')}
                </option>
              ))}
            </select>
          </Field>
          {selectedOrder ? (
            <p className="text-xs text-emerald-800">
              Venda selecionada: controle {selectedOrder.controlNumber} — {selectedOrder.partner.name}
            </p>
          ) : null}
          <FilterControlRangeFields
            idPrefix="so-esp-ctrl"
            controlMin={filters.controlMin}
            controlMax={filters.controlMax}
            onControlMinChange={(controlMin) => patch({ controlMin, salesOrderId: '' })}
            onControlMaxChange={(controlMax) => patch({ controlMax, salesOrderId: '' })}
            minLabel="Controle (venda)"
            maxLabel="Controle até (opcional)"
          />
        </>
      ) : (
        <>
          <FilterPeriodRangeFields
            idPrefix="so-period"
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => patch({ from })}
            onToChange={(to) => patch({ to })}
          />
          <FilterControlRangeFields
            idPrefix="so-ctrl"
            controlMin={filters.controlMin}
            controlMax={filters.controlMax}
            onControlMinChange={(controlMin) => patch({ controlMin })}
            onControlMaxChange={(controlMax) => patch({ controlMax })}
          />
          <PartnerSearchField
            partners={partners}
            partnerId={filters.partnerId}
            label="Cliente"
            onPartnerIdChange={(partnerId) => patch({ partnerId })}
          />
          <Field label="Produto">
            <select
              className={inputClass}
              value={filters.productId}
              onChange={(e) => patch({ productId: e.target.value })}
            >
              <option value="">Todos os produtos</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} — {p.name}
                </option>
              ))}
            </select>
          </Field>
          {filters.variant === 'cliente' || filters.variant === 'produtos' ? (
            <p className="text-xs text-slate-500">Agrupamentos consideram apenas vendas confirmadas.</p>
          ) : null}
        </>
      )}

      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
