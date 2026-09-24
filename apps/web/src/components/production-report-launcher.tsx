'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import {
  defaultProductionReportFilters,
  openProductionReportPrint,
  productionReportTitle,
  PRODUCTION_REPORT_VARIANTS,
  type ProductionReportDomain,
  type ProductionReportFilters,
  type ProductionReportVariant,
} from '@/lib/production-report-query';

type Lot = { id: string; code: string; barn: { name: string } };

export function ProductionReportLauncher({
  domain,
  lots,
  returnHref,
}: {
  domain: ProductionReportDomain;
  lots: Lot[];
  /** URL completa para voltar (incl. ?tab=…) */
  returnHref?: string;
}) {
  const variants = PRODUCTION_REPORT_VARIANTS[domain];
  const [filters, setFilters] = useState<ProductionReportFilters>(() =>
    defaultProductionReportFilters(domain),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilters(defaultProductionReportFilters(domain));
    setError(null);
  }, [domain]);

  function setVariant(variant: ProductionReportVariant) {
    setFilters((f) => ({ ...f, variant }));
    setError(null);
  }

  function patch(partial: Partial<ProductionReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function generate() {
    if (filters.variant === 'periodo') {
      if (!filters.from || !filters.to) {
        setError('Informe o período de e até.');
        return;
      }
    }
    if (filters.variant === 'lote') {
      if (!filters.flockLotId.trim()) {
        setError('Selecione o lote.');
        return;
      }
    }
    setError(null);
    const title = productionReportTitle(domain, filters.variant);
    openProductionReportPrint(filters, title, returnHref);
  }

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          {variants.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="production-report-variant"
                className="mt-1"
                checked={filters.variant === v.id}
                onChange={() => setVariant(v.id)}
              />
              <span className="font-medium">{v.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {filters.variant === 'periodo' || filters.variant === 'totais' ? (
        <>
          <FilterPeriodRangeFields
            idPrefix="prod-report"
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => patch({ from })}
            onToChange={(to) => patch({ to })}
          />
          {filters.variant === 'periodo' ? (
            <p className="text-xs text-slate-500">O período é obrigatório para este relatório.</p>
          ) : (
            <p className="text-xs text-slate-500">
              Período opcional — deixe as datas vazias para totalizar todos os lançamentos.
            </p>
          )}
        </>
      ) : null}

      {filters.variant === 'lote' ? (
        <Field label="Lote">
          <select
            className={inputClass}
            value={filters.flockLotId}
            onChange={(e) => patch({ flockLotId: e.target.value })}
          >
            <option value="">Selecione…</option>
            {lots.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} — {l.barn.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
