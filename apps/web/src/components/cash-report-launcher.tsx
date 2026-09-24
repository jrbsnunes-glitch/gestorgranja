'use client';

import { useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterControlRangeFields, FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import {
  CASH_REPORT_TITLES,
  defaultCashReportFilters,
  openCashReportPrint,
  type CashReportFilters,
  type CashReportVariant,
} from '@/lib/cash-report-query';

const VARIANTS: { id: CashReportVariant; label: string; hint: string }[] = [
  { id: 'controle', label: 'Controle', hint: 'Sessão(ões) pelo número de controle, com todos os lançamentos.' },
  { id: 'periodo', label: 'Período', hint: 'Movimentos entre duas datas, agrupados por sessão.' },
  { id: 'dia', label: 'Caixa do dia', hint: 'Movimentos de um único dia (padrão: hoje).' },
];

export function CashReportLauncher() {
  const [filters, setFilters] = useState<CashReportFilters>(() => defaultCashReportFilters('dia'));
  const [error, setError] = useState<string | null>(null);

  function patch(partial: Partial<CashReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function setVariant(variant: CashReportVariant) {
    setFilters((f) => ({ ...defaultCashReportFilters(variant), variant }));
    setError(null);
  }

  function generate() {
    if (filters.variant === 'controle') {
      if (!filters.controlMin.trim() && !filters.controlMax.trim()) {
        setError('Informe ao menos o controle mínimo (número da sessão).');
        return;
      }
    } else if (filters.variant === 'periodo') {
      if (!filters.from || !filters.to) {
        setError('Informe o período de e até.');
        return;
      }
    } else if (!filters.date) {
      setError('Informe a data.');
      return;
    }
    setError(null);
    openCashReportPrint(filters);
  }

  const active = VARIANTS.find((v) => v.id === filters.variant)!;

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          {VARIANTS.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="cash-report-variant"
                className="mt-1"
                checked={filters.variant === v.id}
                onChange={() => setVariant(v.id)}
              />
              <span>
                <span className="font-medium">{v.label}</span>
                <span className="block text-xs text-slate-500">{v.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-slate-600">{CASH_REPORT_TITLES[filters.variant]}</p>
      {filters.variant === 'controle' ? (
        <FilterControlRangeFields
          idPrefix="cash-ctrl"
          controlMin={filters.controlMin}
          controlMax={filters.controlMax}
          onControlMinChange={(controlMin) => patch({ controlMin })}
          onControlMaxChange={(controlMax) => patch({ controlMax })}
          minLabel="Controle (sessão) de"
          maxLabel="Controle até"
        />
      ) : null}
      {filters.variant === 'periodo' ? (
        <FilterPeriodRangeFields
          idPrefix="cash-period"
          from={filters.from}
          to={filters.to}
          onFromChange={(from) => patch({ from })}
          onToChange={(to) => patch({ to })}
        />
      ) : null}
      {filters.variant === 'dia' ? (
        <Field label="Data">
          <input
            type="date"
            className={inputClass}
            value={filters.date}
            onChange={(e) => patch({ date: e.target.value })}
          />
        </Field>
      ) : null}
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
      <p className="text-xs text-slate-500">{active.hint}</p>
    </div>
  );
}
