'use client';

import { useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox } from '@/components/ui-parts';
import {
  defaultHrPunchReportFilters,
  openHrPunchReportPrint,
  type HrPunchReportFilters,
} from '@/lib/hr-punch-report-query';

export function HrPunchReportLauncher() {
  const [filters, setFilters] = useState<HrPunchReportFilters>(() => defaultHrPunchReportFilters());
  const [error, setError] = useState<string | null>(null);

  function generate() {
    if (filters.from && filters.to && filters.from > filters.to) {
      setError('A data inicial não pode ser posterior à final.');
      return;
    }
    setError(null);
    openHrPunchReportPrint(filters);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Espelho com pares entrada/saída por dia e total de horas (fuso America/Sao_Paulo).
      </p>
      <ErrorBox message={error} />
      <FilterPeriodRangeFields
        idPrefix="hr-punch-report"
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => setFilters((f) => ({ ...f, from }))}
        onToChange={(to) => setFilters((f) => ({ ...f, to }))}
      />
      <Button type="button" onClick={generate}>
        Gerar espelho (impressão)
      </Button>
    </div>
  );
}
