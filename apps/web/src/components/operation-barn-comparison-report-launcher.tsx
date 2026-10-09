'use client';

import { useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox } from '@/components/ui-parts';
import {
  defaultOperationProductionReportFilters,
  openOperationProductionReportPrint,
  type OperationProductionReportFilters,
} from '@/lib/operation-production-report';

export function OperationBarnComparisonReportLauncher() {
  const [filters, setFilters] = useState<OperationProductionReportFilters>(() =>
    defaultOperationProductionReportFilters(),
  );
  const [error, setError] = useState<string | null>(null);

  function generate() {
    if (!filters.from || !filters.to) {
      setError('Informe o período de e até.');
      return;
    }
    if (filters.from > filters.to) {
      setError('A data inicial não pode ser posterior à final.');
      return;
    }
    setError(null);
    openOperationProductionReportPrint(filters);
  }

  return (
    <div className="space-y-4 rounded-md border border-emerald-100 bg-emerald-50/40 p-4">
      <div>
        <h2 className="text-base font-semibold text-emerald-950">Comparativo de galpões e evolução</h2>
        <p className="mt-1 text-sm text-slate-600">
          Totais por galpão no período escolhido e produção dia a dia (comerciais por galpão e consolidado da granja).
        </p>
      </div>
      <ErrorBox message={error} />
      <FilterPeriodRangeFields
        idPrefix="op-barn-report"
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => setFilters((f) => ({ ...f, from }))}
        onToChange={(to) => setFilters((f) => ({ ...f, to }))}
      />
      <p className="text-xs text-slate-500">O período é obrigatório. Use o mesmo intervalo que deseja analisar na operação.</p>
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
