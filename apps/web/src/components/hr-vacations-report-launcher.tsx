'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import {
  defaultHrVacationsReportFilters,
  openHrVacationsReportPrint,
  type HrVacationsReportFilters,
  type HrVacationsReportVariant,
} from '@/lib/hr-vacations-report-query';

type VacationPick = {
  id: string;
  controlNumber: number;
  acquisitionYear: number;
  startsAt: string;
  endsAt: string;
  employee: { name: string; jobTitle?: string | null };
};

type Employee = { jobTitle: string | null };

export function HrVacationsReportLauncher({
  returnHref,
  initialVacationId,
}: {
  returnHref?: string;
  initialVacationId?: string;
}) {
  const [filters, setFilters] = useState<HrVacationsReportFilters>(() =>
    defaultHrVacationsReportFilters(initialVacationId ? 'espelho' : 'listagem'),
  );
  const [vacations, setVacations] = useState<VacationPick[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<VacationPick[]>('/v1/hr/vacations').then(setVacations);
    void apiFetch<Employee[]>('/v1/hr/employees').then(setEmployees);
  }, []);

  useEffect(() => {
    if (initialVacationId) {
      setFilters((f) => ({ ...f, variant: 'espelho', vacationId: initialVacationId }));
    }
  }, [initialVacationId]);

  const jobTitles = useMemo(() => {
    const set = new Set<string>();
    let hasEmpty = false;
    for (const e of employees) {
      const t = e.jobTitle?.trim();
      if (t) set.add(t);
      else hasEmpty = true;
    }
    const list = [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    return { list, hasEmpty };
  }, [employees]);

  function patch(partial: Partial<HrVacationsReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function setVariant(variant: HrVacationsReportVariant) {
    setFilters((f) => ({
      ...f,
      variant,
      vacationId: variant === 'espelho' ? f.vacationId : '',
    }));
    setError(null);
  }

  function generate() {
    if (filters.variant === 'espelho') {
      if (!filters.vacationId.trim()) {
        setError('Selecione a programação na lista ou visualize um registro antes de abrir Relatórios.');
        return;
      }
    }
    setError(null);
    openHrVacationsReportPrint(filters, returnHref);
  }

  const selected = vacations.find((v) => v.id === filters.vacationId);

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="hr-vacations-variant"
              className="mt-1"
              checked={filters.variant === 'espelho'}
              onChange={() => setVariant('espelho')}
            />
            <span>
              <span className="font-medium">Espelho de férias</span>
              <span className="block text-xs text-slate-500">Detalhe de um registro selecionado.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="hr-vacations-variant"
              className="mt-1"
              checked={filters.variant === 'listagem'}
              onChange={() => setVariant('listagem')}
            />
            <span>
              <span className="font-medium">Listagem</span>
              <span className="block text-xs text-slate-500">Por período e cargo do funcionário.</span>
            </span>
          </label>
        </div>
      </fieldset>

      {filters.variant === 'espelho' ? (
        <>
          <Field label="Programação">
            <select
              className={inputClass}
              value={filters.vacationId}
              onChange={(e) => patch({ vacationId: e.target.value })}
            >
              <option value="">— Selecione —</option>
              {vacations.map((v) => (
                <option key={v.id} value={v.id}>
                  Controle {v.controlNumber} · {v.employee.name} ·{' '}
                  {formatCalendarDatePtBR(v.startsAt)}
                </option>
              ))}
            </select>
          </Field>
          {selected ? (
            <p className="text-xs text-emerald-800">
              Selecionado: {selected.employee.name} — {formatCalendarDatePtBR(selected.startsAt)} a{' '}
              {formatCalendarDatePtBR(selected.endsAt)}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <FilterPeriodRangeFields
            idPrefix="hr-vacation-period"
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => patch({ from })}
            onToChange={(to) => patch({ to })}
          />
          <p className="text-xs text-slate-500">
            Inclui férias que intersectam o intervalo (início ou fim dentro do período).
          </p>
          <Field label="Cargo">
            <select
              className={inputClass}
              value={filters.jobTitle}
              onChange={(e) => patch({ jobTitle: e.target.value })}
            >
              <option value="">Todos os cargos</option>
              {jobTitles.hasEmpty ? <option value="__sem_cargo__">Sem cargo informado</option> : null}
              {jobTitles.list.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
        </>
      )}

      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
