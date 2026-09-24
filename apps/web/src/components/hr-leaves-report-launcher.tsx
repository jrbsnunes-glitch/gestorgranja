'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import {
  defaultHrLeavesReportFilters,
  openHrLeavesReportPrint,
  type HrLeavesReportFilters,
  type HrLeavesReportVariant,
} from '@/lib/hr-leaves-report-query';

type LeavePick = {
  id: string;
  controlNumber: number;
  type: string;
  startsAt: string;
  endsAt: string;
  employee: { name: string; jobTitle: string | null };
};

type Employee = { jobTitle: string | null };

export function HrLeavesReportLauncher({
  returnHref,
  initialLeaveId,
}: {
  returnHref?: string;
  initialLeaveId?: string;
}) {
  const [filters, setFilters] = useState<HrLeavesReportFilters>(() =>
    defaultHrLeavesReportFilters(initialLeaveId ? 'espelho' : 'listagem'),
  );
  const [leaves, setLeaves] = useState<LeavePick[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<LeavePick[]>('/v1/hr/leaves').then(setLeaves);
    void apiFetch<Employee[]>('/v1/hr/employees').then(setEmployees);
  }, []);

  useEffect(() => {
    if (initialLeaveId) {
      setFilters((f) => ({ ...f, variant: 'espelho', leaveId: initialLeaveId }));
    }
  }, [initialLeaveId]);

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

  function patch(partial: Partial<HrLeavesReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function setVariant(variant: HrLeavesReportVariant) {
    setFilters((f) => ({
      ...f,
      variant,
      leaveId: variant === 'espelho' ? f.leaveId : '',
    }));
    setError(null);
  }

  function generate() {
    if (filters.variant === 'espelho') {
      if (!filters.leaveId.trim()) {
        setError('Selecione o atestado na lista ou visualize um registro antes de abrir Relatórios.');
        return;
      }
    }
    setError(null);
    openHrLeavesReportPrint(filters, returnHref);
  }

  const selectedLeave = leaves.find((l) => l.id === filters.leaveId);

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="hr-leaves-variant"
              className="mt-1"
              checked={filters.variant === 'espelho'}
              onChange={() => setVariant('espelho')}
            />
            <span>
              <span className="font-medium">Espelho do atestado</span>
              <span className="block text-xs text-slate-500">Detalhe de um registro selecionado.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="hr-leaves-variant"
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
          <Field label="Atestado">
            <select
              className={inputClass}
              value={filters.leaveId}
              onChange={(e) => patch({ leaveId: e.target.value })}
            >
              <option value="">— Selecione —</option>
              {leaves.map((l) => (
                <option key={l.id} value={l.id}>
                  Controle {l.controlNumber} · {l.employee.name} ·{' '}
                  {formatCalendarDatePtBR(l.startsAt)}
                </option>
              ))}
            </select>
          </Field>
          {selectedLeave ? (
            <p className="text-xs text-emerald-800">
              Selecionado: {selectedLeave.employee.name} —{' '}
              {formatCalendarDatePtBR(selectedLeave.startsAt)} a{' '}
              {formatCalendarDatePtBR(selectedLeave.endsAt)}
            </p>
          ) : null}
        </>
      ) : (
        <>
          <FilterPeriodRangeFields
            idPrefix="hr-leave-period"
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => patch({ from })}
            onToChange={(to) => patch({ to })}
          />
          <p className="text-xs text-slate-500">
            Inclui atestados que intersectam o intervalo (início ou fim dentro do período).
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
