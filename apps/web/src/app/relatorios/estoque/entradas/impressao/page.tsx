'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import {
  buildStockReceiptsReportApiPath,
  type StockReceiptsReportFilters,
  type StockReceiptsReportVariant,
} from '@/lib/stock-receipts-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type NoteRow = {
  controlNumber: number;
  receivedAt: string;
  partnerName: string;
  invoiceNumber: string | null;
  nfeAccessKey: string | null;
  stockLocation: string | null;
  totalAmount: number;
  itemCount: number;
};

type ReceiptItem = {
  productSku: string;
  productName: string;
  productUnit: string;
  quantity: number;
  unitCost: number;
  lineTotal: number;
  batchCode: string | null;
  expiresAt: string | null;
};

type ReceiptBlock = {
  controlNumber: number;
  receivedAt: string;
  partnerName: string;
  invoiceNumber: string | null;
  invoiceSeries: string | null;
  nfeAccessKey: string | null;
  totalAmount: number;
  stockLocation: string | null;
  items: ReceiptItem[];
};

type ReportPayload = {
  variant: StockReceiptsReportVariant;
  period: { from: string | null; to: string | null };
  filters: {
    controlMin: number | null;
    controlMax: number | null;
    partnerId: string | null;
    partnerLabel: string | null;
  };
  totals: {
    receiptCount: number;
    totalAmount: number;
    itemLineCount: number;
    quantity?: number;
  };
  noteRows: NoteRow[] | null;
  receipts: ReceiptBlock[] | null;
};

function parseFilters(sp: URLSearchParams): StockReceiptsReportFilters | null {
  const variant = sp.get('variant');
  if (variant !== 'notas' && variant !== 'produtos_por_nota') return null;
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
  const title = sp.get('title') ?? 'Entradas de estoque';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Entradas.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildStockReceiptsReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const periodText =
    data?.period.from || data?.period.to
      ? `${data.period.from ?? '…'} a ${data.period.to ?? '…'} (data do recebimento)`
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
            {data?.totals ? ` · ${data.totals.receiptCount} nota(s)` : null}
          </p>
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error && data.variant === 'notas' ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Controle</th>
                <th className="py-2 pr-2">Recebido</th>
                <th className="py-2 pr-2">Fornecedor</th>
                <th className="py-2 pr-2">NF</th>
                <th className="py-2 pr-2">Chave NFe</th>
                <th className="py-2 pr-2">Local</th>
                <th className="py-2 pr-2 text-right">Itens</th>
                <th className="py-2 pr-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {!data.noteRows?.length ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-slate-500">
                    Nenhuma entrada encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                data.noteRows.map((r) => (
                  <tr key={r.controlNumber} className="border-b border-slate-100">
                    <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDt(r.receivedAt)}</td>
                    <td className="py-2 pr-2">{r.partnerName}</td>
                    <td className="py-2 pr-2">{r.invoiceNumber ?? '—'}</td>
                    <td className="py-2 pr-2 text-xs">{r.nfeAccessKey ?? '—'}</td>
                    <td className="py-2 pr-2 text-xs">{r.stockLocation ?? '—'}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{r.itemCount}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{fmtMoney(r.totalAmount)}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.noteRows && data.noteRows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td colSpan={6} className="py-2 pr-2 text-right">
                    Totais
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{data.totals.itemLineCount}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">
                    {fmtMoney(data.totals.totalAmount)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
      {data && !loading && !error && data.variant === 'produtos_por_nota' ? (
        <div className="space-y-6">
          {!data.receipts?.length ? (
            <p className="text-sm text-slate-500">Nenhuma entrada encontrada com os filtros informados.</p>
          ) : (
            data.receipts.map((rec) => (
              <section key={rec.controlNumber} className="break-inside-avoid">
                <h3 className="border-b border-slate-300 pb-1 text-sm font-semibold text-slate-800">
                  Controle {rec.controlNumber} · {rec.partnerName}
                  {rec.invoiceNumber ? ` · NF ${rec.invoiceNumber}` : ''}
                  <span className="font-normal text-slate-600">
                    {' '}
                    — recebido {fmtDt(rec.receivedAt)} · total {fmtMoney(rec.totalAmount)}
                  </span>
                </h3>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-600">
                      <th className="py-1 pr-2">Produto</th>
                      <th className="py-1 pr-2 text-right">Qtd</th>
                      <th className="py-1 pr-2 text-right">Custo un.</th>
                      <th className="py-1 pr-2 text-right">Total</th>
                      <th className="py-1 pr-2">Lote</th>
                      <th className="py-1">Validade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.items.map((it, idx) => (
                      <tr key={`${rec.controlNumber}-${idx}`} className="border-b border-slate-100">
                        <td className="py-1 pr-2">
                          {it.productSku} — {it.productName}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">
                          {fmtQty(it.quantity)} {it.productUnit}
                        </td>
                        <td className="py-1 pr-2 text-right tabular-nums">{fmtMoney(it.unitCost)}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{fmtMoney(it.lineTotal)}</td>
                        <td className="py-1 pr-2 text-xs">{it.batchCode ?? '—'}</td>
                        <td className="py-1 text-xs">
                          {it.expiresAt
                            ? new Date(it.expiresAt + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))
          )}
          {data.receipts && data.receipts.length > 0 ? (
            <p className="border-t border-slate-300 pt-2 text-sm font-medium text-slate-800">
              Totais: {data.totals.receiptCount} nota(s) · {data.totals.itemLineCount} linha(s) de produto
              · {fmtMoney(data.totals.totalAmount)}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function StockReceiptsReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
