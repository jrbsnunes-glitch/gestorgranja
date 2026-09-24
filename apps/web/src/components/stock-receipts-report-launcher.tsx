'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import {
  FilterControlRangeFields,
  FilterPeriodRangeFields,
} from '@/components/crud/filter-fields';
import { PartnerSearchField } from '@/components/partner-search-field';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import {
  defaultStockReceiptsReportFilters,
  openStockReceiptsReportPrint,
  STOCK_RECEIPTS_REPORT_VARIANTS,
  type StockReceiptsReportFilters,
  type StockReceiptsReportVariant,
} from '@/lib/stock-receipts-report-query';

type Partner = { id: string; name: string; tradeName?: string | null };

export function StockReceiptsReportLauncher({ returnHref }: { returnHref?: string }) {
  const [filters, setFilters] = useState<StockReceiptsReportFilters>(() =>
    defaultStockReceiptsReportFilters(),
  );
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
  }, []);

  function patch(partial: Partial<StockReceiptsReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function setVariant(variant: StockReceiptsReportVariant) {
    setFilters((f) => ({ ...f, variant }));
    setError(null);
  }

  function generate() {
    setError(null);
    openStockReceiptsReportPrint(filters, returnHref);
  }

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          {STOCK_RECEIPTS_REPORT_VARIANTS.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="stock-receipts-report-variant"
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
      <FilterPeriodRangeFields
        idPrefix="sr-period"
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => patch({ from })}
        onToChange={(to) => patch({ to })}
      />
      <FilterControlRangeFields
        idPrefix="sr-ctrl"
        controlMin={filters.controlMin}
        controlMax={filters.controlMax}
        onControlMinChange={(controlMin) => patch({ controlMin })}
        onControlMaxChange={(controlMax) => patch({ controlMax })}
      />
      <PartnerSearchField
        partners={partners}
        partnerId={filters.partnerId}
        label="Fornecedor"
        onPartnerIdChange={(partnerId) => patch({ partnerId })}
      />
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
