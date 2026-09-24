'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import {
  buildStockMovementsReportApiPath,
  type StockMovementsReportFilters,
} from '@/lib/stock-movements-report-query';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type ReportRow = {
  controlNumber: number;
  movedAt: string;
  type: string;
  quantity: number;
  unitCost: number | null;
  reference: string | null;
  productSku: string;
  productName: string;
  productUnit: string;
  chartAccount: string;
  stockLocation: string | null;
};

type ReportPayload = {
  period: { from: string | null; to: string | null };
  filters: {
    controlMin: number | null;
    controlMax: number | null;
    chartAccountId: string | null;
    chartAccountLabel: string | null;
    includeIn: boolean;
    includeOut: boolean;
    includeAdjust: boolean;
  };
  totals: {
    rowCount: number;
    quantityIn: number;
    quantityOut: number;
    quantityAdjust: number;
    stockValue: number;
  };
  rows: ReportRow[];
};

function parseFilters(sp: URLSearchParams): StockMovementsReportFilters | null {
  const bool = (key: string) => sp.get(key) !== '0';
  return {
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    controlMin: sp.get('controlMin') ?? '',
    controlMax: sp.get('controlMax') ?? '',
    chartAccountId: sp.get('chartAccountId') ?? '',
    includeIn: bool('includeIn'),
    includeOut: bool('includeOut'),
    includeAdjust: bool('includeAdjust'),
  };
}

function fmtQty(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 });
}

function fmtMoney(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Estoque — movimentações';
  const filters = useMemo(() => parseFilters(sp), [sp]);
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!filters) {
      setError('Parâmetros inválidos. Gere o relatório a partir do módulo Estoque.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    void apiFetch<ReportPayload>(buildStockMovementsReportApiPath(filters))
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar'))
      .finally(() => setLoading(false));
  }, [filters]);

  useReportAutoPrint(!loading && !error && data != null);

  const periodText =
    data?.period.from || data?.period.to
      ? `${data.period.from ?? '…'} a ${data.period.to ?? '…'} (data da movimentação)`
      : 'Todo o período';

  const filterExtras = useMemo(() => {
    if (!data) return '';
    const parts: string[] = [];
    if (data.filters.controlMin != null || data.filters.controlMax != null) {
      parts.push(
        `Controle ${data.filters.controlMin ?? '…'} a ${data.filters.controlMax ?? '…'}`,
      );
    }
    if (data.filters.chartAccountLabel) {
      parts.push(`Conta: ${data.filters.chartAccountLabel}`);
    }
    const types: string[] = [];
    if (data.filters.includeIn) types.push('Entrada');
    if (data.filters.includeOut) types.push('Saída');
    if (data.filters.includeAdjust) types.push('Ajuste');
    if (types.length && types.length < 3) parts.push(`Tipos: ${types.join(', ')}`);
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
            {data?.totals ? ` · ${data.totals.rowCount} movimento(s)` : null}
          </p>
        }
      />
      {loading ? <p className="text-sm text-slate-600">Carregando dados…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {data && !loading && !error ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="py-2 pr-2">Controle</th>
                <th className="py-2 pr-2">Data</th>
                <th className="py-2 pr-2">Produto</th>
                <th className="py-2 pr-2">Conta contábil</th>
                <th className="py-2 pr-2">Tipo</th>
                <th className="py-2 pr-2 text-right">Qtd</th>
                <th className="py-2 pr-2 text-right">Custo un.</th>
                <th className="py-2 pr-2">Local</th>
                <th className="py-2">Referência</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500">
                    Nenhuma movimentação encontrada com os filtros informados.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.controlNumber} className="border-b border-slate-100">
                    <td className="py-2 pr-2 tabular-nums">{r.controlNumber}</td>
                    <td className="py-2 pr-2 whitespace-nowrap">{fmtDt(r.movedAt)}</td>
                    <td className="py-2 pr-2">
                      {r.productSku} — {r.productName}
                    </td>
                    <td className="py-2 pr-2 text-xs">{r.chartAccount}</td>
                    <td className="py-2 pr-2">{labelEnum(r.type)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {fmtQty(r.quantity)} {r.productUnit}
                    </td>
                    <td className="py-2 pr-2 text-right tabular-nums">
                      {r.unitCost != null ? fmtMoney(r.unitCost) : '—'}
                    </td>
                    <td className="py-2 pr-2 text-xs">{r.stockLocation ?? '—'}</td>
                    <td className="py-2 text-xs text-slate-700">{r.reference ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
            {data.rows.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-300 font-medium">
                  <td colSpan={5} className="py-2 pr-2 text-right">
                    Totais (qtd.)
                  </td>
                  <td className="py-2 pr-2 text-right text-xs leading-snug tabular-nums">
                    <div>Entrada: {fmtQty(data.totals.quantityIn)}</div>
                    <div>Saída: {fmtQty(data.totals.quantityOut)}</div>
                    <div>Ajuste: {fmtQty(data.totals.quantityAdjust)}</div>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums" colSpan={3}>
                    Valor (qtd. × custo): {fmtMoney(data.totals.stockValue)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      ) : null}
    </div>
  );
}

export default function StockMovementsReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
