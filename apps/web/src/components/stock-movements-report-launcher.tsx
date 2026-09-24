'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import {
  FilterControlRangeFields,
  FilterPeriodRangeFields,
} from '@/components/crud/filter-fields';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import {
  defaultStockMovementsReportFilters,
  openStockMovementsReportPrint,
  type StockMovementsReportFilters,
} from '@/lib/stock-movements-report-query';

type ChartAccountOption = { id: string; code: string; name: string };

export function StockMovementsReportLauncher({ returnHref }: { returnHref?: string }) {
  const [filters, setFilters] = useState<StockMovementsReportFilters>(() =>
    defaultStockMovementsReportFilters(),
  );
  const [chartAccounts, setChartAccounts] = useState<ChartAccountOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = new URLSearchParams({ flow: 'stock', posting: '1' });
    void apiFetch<ChartAccountOption[]>(`/v1/cadastros/chart-accounts?${q.toString()}`).then(
      setChartAccounts,
    );
  }, []);

  function patch(partial: Partial<StockMovementsReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function generate() {
    const anyType = filters.includeIn || filters.includeOut || filters.includeAdjust;
    if (!anyType) {
      setError('Marque ao menos um tipo de movimentação.');
      return;
    }
    setError(null);
    openStockMovementsReportPrint(filters, returnHref);
  }

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <FilterPeriodRangeFields
        idPrefix="sm-period"
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => patch({ from })}
        onToChange={(to) => patch({ to })}
      />
      <FilterControlRangeFields
        idPrefix="sm-ctrl"
        controlMin={filters.controlMin}
        controlMax={filters.controlMax}
        onControlMinChange={(controlMin) => patch({ controlMin })}
        onControlMaxChange={(controlMax) => patch({ controlMax })}
      />
      <Field label="Conta contábil">
        <select
          className={inputClass}
          value={filters.chartAccountId}
          onChange={(e) => patch({ chartAccountId: e.target.value })}
        >
          <option value="">Todas as contas</option>
          {chartAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} — {a.name}
            </option>
          ))}
        </select>
      </Field>
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeIn}
              onChange={(e) => patch({ includeIn: e.target.checked })}
            />
            Entrada
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeOut}
              onChange={(e) => patch({ includeOut: e.target.checked })}
            />
            Saída
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeAdjust}
              onChange={(e) => patch({ includeAdjust: e.target.checked })}
            />
            Ajuste
          </label>
        </div>
      </fieldset>
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
