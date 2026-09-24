'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import {
  FilterControlRangeFields,
  FilterPeriodRangeFields,
} from '@/components/crud/filter-fields';
import { PartnerSearchField } from '@/components/partner-search-field';
import { ErrorBox } from '@/components/ui-parts';
import {
  defaultFinanceTitlesFilters,
  openFinanceTitlesReportPrint,
  type FinanceTitleKind,
  type FinanceTitlesReportFilters,
} from '@/lib/finance-titles-report-query';

type Partner = { id: string; name: string };

export function FinanceTitlesReportLauncher({
  kind,
  reportTitle,
  partners,
}: {
  kind: FinanceTitleKind;
  reportTitle: string;
  partners: Partner[];
}) {
  const [filters, setFilters] = useState<FinanceTitlesReportFilters>(() => defaultFinanceTitlesFilters(kind));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilters(defaultFinanceTitlesFilters(kind));
    setError(null);
  }, [kind]);

  function patch(partial: Partial<FinanceTitlesReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function generate() {
    const anyBucket =
      filters.includeOpen ||
      filters.includeSettled ||
      filters.includePartialPayment ||
      filters.includePartialOpen;
    if (!anyBucket) {
      setError('Marque ao menos uma situação de título.');
      return;
    }
    setError(null);
    openFinanceTitlesReportPrint(filters, reportTitle);
  }

  const partnerLabel = kind === 'receivable' ? 'Cliente' : 'Fornecedor';

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <FilterPeriodRangeFields
        idPrefix={`ft-${kind}`}
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => patch({ from })}
        onToChange={(to) => patch({ to })}
      />
      <FilterControlRangeFields
        idPrefix={`ft-${kind}`}
        controlMin={filters.controlMin}
        controlMax={filters.controlMax}
        onControlMinChange={(controlMin) => patch({ controlMin })}
        onControlMaxChange={(controlMax) => patch({ controlMax })}
      />
      <PartnerSearchField
        partners={partners}
        partnerId={filters.partnerId}
        label={partnerLabel}
        onPartnerIdChange={(partnerId) => patch({ partnerId })}
      />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Títulos</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeOpen}
              onChange={(e) => patch({ includeOpen: e.target.checked })}
            />
            Abertos
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includeSettled}
              onChange={(e) => patch({ includeSettled: e.target.checked })}
            />
            Liquidados
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includePartialPayment}
              onChange={(e) => patch({ includePartialPayment: e.target.checked })}
            />
            Pagamentos parciais
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.includePartialOpen}
              onChange={(e) => patch({ includePartialOpen: e.target.checked })}
            />
            Parciais em aberto
          </label>
        </div>
      </fieldset>
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
