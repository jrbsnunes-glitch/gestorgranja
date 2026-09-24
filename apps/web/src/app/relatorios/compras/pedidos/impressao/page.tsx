'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import {
  buildPurchaseOrdersReportApiPath,
  type PurchaseOrdersReportFilters,
  type PurchaseOrdersReportVariant,
} from '@/lib/purchase-orders-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type OrderRow = {
  controlNumber: number;
  requestCode: string;
  description: string;
  status: string;
  orderNumber: string;
  orderedAt: string;
  supplierName: string;
  totalAmount: number;
  financeApproved: boolean;
  payablesGenerated: boolean;
  receivedAt: string | null;
  itemCount: number;
};

type OrderItem = {
  productSku: string;
  productName: string;
  productUnit: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type OrderBlock = {
  controlNumber: number;
  requestCode: string;
  orderNumber: string;
  orderedAt: string;
  supplierName: string;
  totalAmount: number;
  status: string;
  items: OrderItem[];
};

type ReportPayload = {
  variant: PurchaseOrdersReportVariant;
  period: { from: string | null; to: string | null };
  filters: {
    controlMin: number | null;
    controlMax: number | null;
    partnerId: string | null;
    partnerLabel: string | null;
  };
  totals: {
    orderCount: number;
    totalAmount: number;
    itemLineCount: number;
    quantity?: number;
  };
  orderRows: OrderRow[] | null;
  orders: OrderBlock[] | null;
};

function parseFilters(sp: URLSearchParams): PurchaseOrdersReportFilters | null {
  const variant = sp.get('variant');
  if (variant !== 'pedidos' && variant !== 'produtos_por_pedido') return null;
  return {
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    controlMin: sp.get('controlMin') ?? '',
    controlMax: sp.get('controlMax') ?? '',
    partnerId: sp.get('partnerId') ?? '',
  };
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQty(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Compras — pedidos';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Compras.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildPurchaseOrdersReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const periodText =
    data?.period.from || data?.period.to
      ? `${data.period.from ?? '…'} a ${data.period.to ?? '…'} (data do pedido)`
      : 'Todo o período';

  const filterExtras = useMemo(() => {
    if (!data) return '';
    const parts: string[] = [];
    if (data.filters.controlMin != null || data.filters.controlMax != null) {
      parts.push(
        `Controle ${data.filters.controlMin ?? '…'} a ${data.filters.controlMax ?? '…'}`,
      );
    }
    if (data.filters.partnerLabel) parts.push(`Fornecedor: ${data.filters.partnerLabel}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle={title}
        documentExtras={
          <p className="mt-1 text-sm text-slate-600">
            Período: {periodText}
            {filterExtras}
            {data?.totals ? ` · ${data.totals.orderCount} pedido(s)` : null}
          </p>
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error && data.variant === 'pedidos' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Controle</th>
                <th className="py-2 pr-2">Pedido</th>
                <th className="py-2 pr-2">Requisição</th>
                <th className="py-2 pr-2">Fornecedor</th>
                <th className="py-2 pr-2">Emitido</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2 text-right">Itens</th>
                <th className="py-2 pr-2 text-right">Total</th>
                <th className="py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {!data.orderRows?.length ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    Nenhum pedido encontrado com os filtros informados.
                  </td>
                </tr>
              ) : (
                data.orderRows.map((r) => {
                  const flags = [
                    r.financeApproved ? 'Fin. aprovado' : null,
                    r.payablesGenerated ? 'CP gerada' : null,
                    r.receivedAt ? 'Recebido' : null,
                  ]
                    .filter(Boolean)
                    .join(', ');
                  return (
                    <tr key={`${r.controlNumber}-${r.orderNumber}`} className="border-b border-slate-100">
                      <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                      <td className="py-2 pr-2 font-medium">{r.orderNumber}</td>
                      <td className="py-2 pr-2">
                        {r.requestCode}
                        <span className="block text-xs text-slate-500">{r.description}</span>
                      </td>
                      <td className="py-2 pr-2">{r.supplierName}</td>
                      <td className="py-2 pr-2 whitespace-nowrap">{fmtDt(r.orderedAt)}</td>
                      <td className="py-2 pr-2">{labelEnum(r.status)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{r.itemCount}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.totalAmount)}</td>
                      <td className="py-2 text-xs text-slate-700">{flags || '—'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {data.orderRows && data.orderRows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td colSpan={6} className="py-2 pr-2 text-right">
                    Totais
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{data.totals.itemLineCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {fmtMoney(data.totals.totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
      {data && !loading && !error && data.variant === 'produtos_por_pedido' ? (
        <div className="space-y-6">
          {!data.orders?.length ? (
            <p className="text-sm text-slate-500">Nenhum pedido encontrado com os filtros informados.</p>
          ) : (
            data.orders.map((ord) => (
              <section key={ord.controlNumber} className="break-inside-avoid">
                <h3 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">
                  Controle {ord.controlNumber} · Pedido {ord.orderNumber} · {ord.supplierName}
                  <span className="font-normal text-slate-600">
                    {' '}
                    — {fmtDt(ord.orderedAt)} · {labelEnum(ord.status)} · total{' '}
                    {fmtMoney(ord.totalAmount)}
                  </span>
                </h3>
                {ord.items.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Nenhum item de produto cadastrado neste pedido (valor da cotação vencedora).
                  </p>
                ) : (
                  <table className="mt-2 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-600">
                        <th className="py-1 pr-2">Produto</th>
                        <th className="py-1 pr-2 text-right">Qtd</th>
                        <th className="py-1 pr-2 text-right">Preço un.</th>
                        <th className="py-1 pr-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ord.items.map((it, idx) => (
                        <tr key={`${ord.controlNumber}-${idx}`} className="border-b border-slate-100">
                          <td className="py-1 pr-2">
                            {it.productSku} — {it.productName}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums">
                            {fmtQty(it.quantity)} {it.productUnit}
                          </td>
                          <td className="py-1 pr-2 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                          <td className="py-1 pr-2 text-right tabular-nums">{fmtMoney(it.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>
            ))
          )}
          {data.orders && data.orders.length > 0 ? (
            <p className="border-t border-slate-300 pt-2 text-sm font-medium text-slate-800">
              Totais: {data.totals.orderCount} pedido(s) · {data.totals.itemLineCount} linha(s) de produto
              · {fmtMoney(data.totals.totalAmount)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function PurchaseOrdersReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
