'use client';

import { useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterControlRangeFields } from '@/components/crud/filter-fields';
import {
  defaultHrEmployeesReportFilters,
  HR_EMPLOYEES_SORT_OPTIONS,
  openHrEmployeesReportPrint,
  type HrEmployeesReportFilters,
  type HrEmployeesReportSort,
} from '@/lib/hr-employees-report-query';

export function HrEmployeesReportLauncher({ returnHref }: { returnHref?: string }) {
  const [filters, setFilters] = useState<HrEmployeesReportFilters>(() => defaultHrEmployeesReportFilters());

  function patch(partial: Partial<HrEmployeesReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function generate() {
    openHrEmployeesReportPrint(filters, returnHref);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">Listagem geral de funcionários cadastrados (ativos e inativos).</p>
      <FilterControlRangeFields
        idPrefix="hr-emp-ctrl"
        controlMin={filters.controlMin}
        controlMax={filters.controlMax}
        onControlMinChange={(controlMin) => patch({ controlMin })}
        onControlMaxChange={(controlMax) => patch({ controlMax })}
      />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Ordenação</legend>
        <div className="mt-1 flex flex-col gap-2">
          {HR_EMPLOYEES_SORT_OPTIONS.map((opt) => (
            <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="hr-employees-sort"
                checked={filters.sort === opt.id}
                onChange={() => patch({ sort: opt.id as HrEmployeesReportSort })}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
