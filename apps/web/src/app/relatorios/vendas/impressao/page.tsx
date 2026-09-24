'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import {
  buildSalesOrdersReportApiPath,
  type SalesOrdersReportFilters,
  type SalesOrdersReportVariant,
} from '@/lib/sales-orders-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type EspelhoItem = {
  productSku: string | null;
  productName: string;
  productUnit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
};

type EspelhoOrder = {
  controlNumber: number;
  orderDate: string;
  partnerName: string;
  status: string;
  paymentMethod: string | null;
  totalAmount: number;
  items: EspelhoItem[];
};

type PeriodRow = {
  controlNumber: number;
  orderDate: string;
  partnerName: string;
  status: string;
  paymentMethod: string | null;
  totalAmount: number;
  itemCount: number;
};

type ClientGroup = {
  partnerName: string;
  orderCount: number;
  quantity: number;
  totalAmount: number;
};

type ProductGroup = {
  productLabel: string;
  orderCount: number;
  quantity: number;
  totalAmount: number;
};

type ReportPayload = {
  variant: SalesOrdersReportVariant;
  period: { from: string | null; to: string | null };
  filters: {
    controlMin: number | null;
    controlMax: number | null;
    partnerId: string | null;
    partnerLabel: string | null;
    productId: string | null;
    productLabel: string | null;
  };
  totals: {
    orderCount: number;
    totalAmount: number;
    quantity: number;
    itemLineCount: number;
  };
  espelho: EspelhoOrder | null;
  periodRows: PeriodRow[] | null;
  clientGroups: ClientGroup[] | null;
  productGroups: ProductGroup[] | null;
};

function parseFilters(sp: URLSearchParams): SalesOrdersReportFilters | null {
  const variant = sp.get('variant');
  if (variant !== 'espelho' && variant !== 'periodo' && variant !== 'cliente' && variant !== 'produtos') {
    return null;
  }
  return {
    variant,
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    controlMin: sp.get('controlMin') ?? '',
    controlMax: sp.get('controlMax') ?? '',
    partnerId: sp.get('partnerId') ?? '',
    productId: sp.get('productId') ?? '',
    salesOrderId: sp.get('salesOrderId') ?? '',
  };
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtQty(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório de vendas';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Vendas.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildSalesOrdersReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const periodText =
    data?.variant === 'espelho'
      ? null
      : data?.period.from || data?.period.to
        ? `${data.period.from ?? '…'} a ${data.period.to ?? '…'} (data da venda)`
        : 'Todo o período';

  const filterExtras = useMemo(() => {
    if (!data || data.variant === 'espelho') return '';
    const parts: string[] = [];
    if (data.filters.controlMin != null || data.filters.controlMax != null) {
      parts.push(
        `Controle ${data.filters.controlMin ?? '…'} a ${data.filters.controlMax ?? '…'}`,
      );
    }
    if (data.filters.partnerLabel) parts.push(`Cliente: ${data.filters.partnerLabel}`);
    if (data.filters.productLabel) parts.push(`Produto: ${data.filters.productLabel}`);
    return parts.length ? ` · ${parts.join(' · ')}` : '';
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle={title}
        documentExtras={
          data?.variant === 'espelho' && data.espelho ? (
            <p className="mt-1 text-sm text-slate-600">
              Controle {data.espelho.controlNumber} · Cliente: {data.espelho.partnerName} ·{' '}
              {new Date(data.espelho.orderDate + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          ) : periodText ? (
            <p className="mt-1 text-sm text-slate-600">
              Período: {periodText}
              {filterExtras}
              {data?.totals ? ` · ${data.totals.orderCount} venda(s)` : null}
            </p>
          ) : null
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      {data && !loading && !error && data.variant === 'espelho' ? (
        data.espelho ? (
          <div className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-slate-600">Status:</span> {labelEnum(data.espelho.status)}
              </p>
              <p>
                <span className="text-slate-600">Pagamento:</span>{' '}
                {data.espelho.paymentMethod ? labelEnum(data.espelho.paymentMethod) : '—'}
              </p>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
                  <th className="py-2 pr-2">Produto</th>
                  <th className="py-2 pr-2 text-right">Qtd</th>
                  <th className="py-2 pr-2 text-right">Preço un.</th>
                  <th className="py-2 pr-2 text-right">Desconto</th>
                  <th className="py-2 pr-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.espelho.items.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-2 pr-2">
                      {it.productSku ? `${it.productSku} — ` : ''}
                      {it.productName}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {fmtQty(it.quantity)} {it.productUnit}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(it.unitPrice)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(it.discount)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-300 font-semibold">
                  <td colSpan={4} className="py-2 pr-2 text-right">
                    Total da venda
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {fmtMoney(data.espelho.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Venda não encontrada.</p>
        )
      ) : null}

      {data && !loading && !error && data.variant === 'periodo' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Controle</th>
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Cliente</th>
                <th className="py-2 pr-2">Pagamento</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2 text-right">Itens</th>
                <th className="py-2 pr-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {!data.periodRows?.length ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Nenhuma venda encontrada.
                  </td>
                </tr>
              ) : (
                data.periodRows.map((r) => (
                  <tr key={r.controlNumber} className="border-b border-slate-100">
                    <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">
                      {new Date(r.orderDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="py-2 pr-2">{r.partnerName}</td>
                    <td className="py-2 pr-2">{r.paymentMethod ? labelEnum(r.paymentMethod) : '—'}</td>
                    <td className="py-2 pr-2">{labelEnum(r.status)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.itemCount}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.periodRows && data.periodRows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td colSpan={5} className="py-2 pr-2 text-right">
                    Totais ({data.totals.orderCount} venda(s))
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{data.totals.itemLineCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(data.totals.totalAmount)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {data && !loading && !error && data.variant === 'cliente' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
                <th className="py-2 pr-2">Cliente</th>
                <th className="py-2 pr-2 text-right">Vendas</th>
                <th className="py-2 pr-2 text-right">Qtd total</th>
                <th className="py-2 pr-2 text-right">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {!data.clientGroups?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Nenhum dado para agrupar.
                  </td>
                </tr>
              ) : (
                data.clientGroups.map((g) => (
                  <tr key={g.partnerName} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{g.partnerName}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{g.orderCount}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtQty(g.quantity)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(g.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.clientGroups && data.clientGroups.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td className="py-2 pr-2 text-right">Totais gerais</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{data.totals.orderCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtQty(data.totals.quantity)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(data.totals.totalAmount)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}

      {data && !loading && !error && data.variant === 'produtos' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-600">
                <th className="py-2 pr-2">Produto</th>
                <th className="py-2 pr-2 text-right">Vendas c/ item</th>
                <th className="py-2 pr-2 text-right">Qtd total</th>
                <th className="py-2 pr-2 text-right">Valor total</th>
              </tr>
            </thead>
            <tbody>
              {!data.productGroups?.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    Nenhum dado para agrupar.
                  </td>
                </tr>
              ) : (
                data.productGroups.map((g) => (
                  <tr key={g.productLabel} className="border-b border-slate-100">
                    <td className="py-2 pr-2">{g.productLabel}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{g.orderCount}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtQty(g.quantity)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(g.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.productGroups && data.productGroups.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td className="py-2 pr-2 text-right">
                    Totais gerais ({data.totals.orderCount} venda(s))
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{data.totals.itemLineCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtQty(data.totals.quantity)}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(data.totals.totalAmount)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function SalesOrdersReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
