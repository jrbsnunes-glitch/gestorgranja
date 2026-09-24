'use client';

import { useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import {
  CASH_FLOW_KINDS,
  defaultCashFlowReportFilters,
  openCashFlowReportPrint,
  type CashFlowReportFilters,
} from '@/lib/cash-flow-report-query';

export function CashFlowReportLauncher() {
  const [filters, setFilters] = useState<CashFlowReportFilters>(() => defaultCashFlowReportFilters());
  const [error, setError] = useState<string | null>(null);

  function patch(partial: Partial<CashFlowReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function generate() {
    if (!filters.from || !filters.to) {
      setError('Informe o período (de e até).');
      return;
    }
    setError(null);
    openCashFlowReportPrint(filters);
  }

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <FilterPeriodRangeFields
        idPrefix="cf-report"
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => patch({ from })}
        onToChange={(to) => patch({ to })}
      />
      <Field label="Tipo de movimento">
        <select
          className={inputClass}
          value={filters.kind}
          onChange={(e) => patch({ kind: e.target.value })}
        >
          {CASH_FLOW_KINDS.map((k) => (
            <option key={k.value || 'all'} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Incluir no fluxo</legend>
        <div className="mt-2 flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includePayables}
              onChange={(e) => patch({ includePayables: e.target.checked })}
            />
            CP previstas
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includeReceivables}
              onChange={(e) => patch({ includeReceivables: e.target.checked })}
            />
            CR previstas
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includePurchases}
              onChange={(e) => patch({ includePurchases: e.target.checked })}
            />
            Compras aprovadas
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={filters.includeBankBalance}
              onChange={(e) => patch({ includeBankBalance: e.target.checked })}
            />
            Saldo bancário inicial
          </label>
        </div>
      </fieldset>
      <Button type="button" onClick={generate}>
        Gerar relatório (nova aba)
      </Button>
    </div>
  );
}
