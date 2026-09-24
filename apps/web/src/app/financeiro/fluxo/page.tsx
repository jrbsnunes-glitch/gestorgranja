'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { CashFlowReportLauncher } from '@/components/cash-flow-report-launcher';
import {
  CrudToolbar,
  FilterModal,
  FilterModalActions,
  FilterPeriodRangeFields,
  ModuleReportsModal,
  PageIntro,
} from '@/components/crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox, PageCard, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { CASH_FLOW_KINDS, defaultCashFlowReportFilters } from '@/lib/cash-flow-report-query';
import { errorMessage } from '@/lib/labels';

type CashFlow = {
  period: { from: string; to: string };
  openingBalance: number;
  closingBalance: number;
  totals: { inflow: number; outflow: number };
  rows: {
    date: string;
    kind: string;
    description: string;
    inflow: number;
    outflow: number;
    balance: number;
    projected: boolean;
  }[];
};

type FlowFilters = {
  from: string;
  to: string;
  kind: string;
  includePayables: boolean;
  includeReceivables: boolean;
  includePurchases: boolean;
  includeBankBalance: boolean;
};

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function filtersActive(f: FlowFilters): boolean {
  const d = defaultCashFlowReportFilters();
  return (
    f.kind !== '' ||
    f.from !== d.from ||
    f.to !== d.to ||
    f.includePayables !== d.includePayables ||
    f.includeReceivables !== d.includeReceivables ||
    f.includePurchases !== d.includePurchases ||
    f.includeBankBalance !== d.includeBankBalance
  );
}

export default function FinanceiroFluxoPage() {
  const [applied, setApplied] = useState<FlowFilters>(() => defaultCashFlowReportFilters());
  const [draft, setDraft] = useState<FlowFilters>(() => defaultCashFlowReportFilters());
  const [filterOpen, setFilterOpen] = useState(false);
  const [data, setData] = useState<CashFlow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);

  const filtersOn = useMemo(() => filtersActive(applied), [applied]);

  const load = useCallback(() => {
    const p = new URLSearchParams();
    if (applied.from) p.set('from', applied.from);
    if (applied.to) p.set('to', applied.to);
    if (applied.kind) p.set('kind', applied.kind);
    p.set('includePayables', applied.includePayables ? '1' : '0');
    p.set('includeReceivables', applied.includeReceivables ? '1' : '0');
    p.set('includePurchases', applied.includePurchases ? '1' : '0');
    p.set('includeBankBalance', applied.includeBankBalance ? '1' : '0');
    void apiFetch<CashFlow>(`/v1/finance/cash-flow?${p}`)
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [applied]);

  useEffect(() => {
    load();
  }, [load]);

  function openFilters() {
    setDraft(applied);
    setFilterOpen(true);
  }

  function applyFilters() {
    setApplied(draft);
    setFilterOpen(false);
  }

  function clearFilters() {
    const d = defaultCashFlowReportFilters();
    setDraft(d);
    setApplied(d);
    setFilterOpen(false);
  }

  return (
    <AdminShell title="Financeiro — Fluxo">
      <PageIntro title="Fluxo de caixa" description="Realizado e previsto (CP, CR, compras e caixa)." />
      <ErrorBox message={error} />
      <CrudToolbar
        leadingPrimary={
          <Button
            type="button"
            variant={filtersOn ? 'primary' : 'secondary'}
            className="min-h-11"
            onClick={openFilters}
            title={filtersOn ? 'Filtros ativos — clique para alterar' : 'Filtrar listagem'}
          >
            Filtros{filtersOn ? ' ●' : ''}
          </Button>
        }
        onReports={() => setReportsOpen(true)}
      />
      <FilterModal open={filterOpen} onClose={() => setFilterOpen(false)}>
        <FilterPeriodRangeFields
          idPrefix="fluxo"
          from={draft.from}
          to={draft.to}
          onFromChange={(from) => setDraft((f) => ({ ...f, from }))}
          onToChange={(to) => setDraft((f) => ({ ...f, to }))}
        />
        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-slate-600">Tipo</span>
          <select className={inputClass} value={draft.kind} onChange={(e) => setDraft((f) => ({ ...f, kind: e.target.value }))}>
            {CASH_FLOW_KINDS.map((k) => (
              <option key={k.value || 'all'} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="mt-3 rounded-md border border-slate-200 bg-white p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Incluir no fluxo</legend>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.includePayables}
                onChange={(e) => setDraft((f) => ({ ...f, includePayables: e.target.checked }))}
              />
              CP previstas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.includeReceivables}
                onChange={(e) => setDraft((f) => ({ ...f, includeReceivables: e.target.checked }))}
              />
              CR previstas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.includePurchases}
                onChange={(e) => setDraft((f) => ({ ...f, includePurchases: e.target.checked }))}
              />
              Compras aprovadas
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.includeBankBalance}
                onChange={(e) => setDraft((f) => ({ ...f, includeBankBalance: e.target.checked }))}
              />
              Saldo bancário inicial
            </label>
          </div>
        </fieldset>
        <FilterModalActions onClear={clearFilters} onCancel={() => setFilterOpen(false)} onApply={applyFilters} />
      </FilterModal>
      {data ? (
        <PageCard title={`Período ${data.period.from} a ${data.period.to}`}>
          <p className="mb-3 text-sm text-slate-600">
            Saldo de abertura {money(data.openingBalance)}
            {applied.kind ? ` — filtro: ${applied.kind}` : ''}
          </p>
          <ResponsiveTableWrap>
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Data</th>
                  <th className="py-2">Tipo</th>
                  <th className="py-2">Descrição</th>
                  <th className="py-2 text-right">Entrada</th>
                  <th className="py-2 text-right">Saída</th>
                  <th className="py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      Nenhum movimento no período com os filtros informados.
                    </td>
                  </tr>
                ) : (
                  data.rows.map((r, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${r.projected ? 'text-slate-500 italic' : ''}`}>
                      <td className="py-2">{r.date}</td>
                      <td className="py-2">{r.kind}</td>
                      <td className="py-2">{r.description}</td>
                      <td className="py-2 text-right tabular-nums">{r.inflow ? money(r.inflow) : '—'}</td>
                      <td className="py-2 text-right tabular-nums">{r.outflow ? money(r.outflow) : '—'}</td>
                      <td className="py-2 text-right tabular-nums">{money(r.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-semibold">
                  <td className="py-2" colSpan={3}>
                    Totais do período
                  </td>
                  <td className="py-2 text-right tabular-nums">{money(data.totals.inflow)}</td>
                  <td className="py-2 text-right tabular-nums">{money(data.totals.outflow)}</td>
                  <td className="py-2 text-right tabular-nums">{money(data.closingBalance)}</td>
                </tr>
              </tfoot>
            </table>
          </ResponsiveTableWrap>
        </PageCard>
      ) : null}
      <ModuleReportsModal open={reportsOpen} title="Fluxo de caixa" onClose={() => setReportsOpen(false)} compactLauncher wide>
        <CashFlowReportLauncher />
      </ModuleReportsModal>
    </AdminShell>
  );
}
