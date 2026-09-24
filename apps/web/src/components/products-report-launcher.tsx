'use client';

import { useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ErrorBox, Field } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import {
  defaultProductsReportFilters,
  openProductsReportPrint,
  PRODUCTS_REPORT_VARIANTS,
  productsReportTitle,
  type ProductsReportFilters,
  type ProductsReportVariant,
} from '@/lib/products-report-query';

type StockLoc = { id: string; code: string; name: string; isActive: boolean };

export function ProductsReportLauncher({ returnHref }: { returnHref?: string }) {
  const [filters, setFilters] = useState<ProductsReportFilters>(() => defaultProductsReportFilters());
  const [locations, setLocations] = useState<StockLoc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<StockLoc[]>('/v1/cadastros/general/stock-locations').then(setLocations);
  }, []);

  function setVariant(variant: ProductsReportVariant) {
    setFilters((f) => ({ ...f, variant }));
    setError(null);
  }

  function patch(partial: Partial<ProductsReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function toggleLocation(id: string) {
    setFilters((f) => {
      const set = new Set(f.stockLocationIds);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return { ...f, stockLocationIds: [...set] };
    });
  }

  function generate() {
    if (filters.variant === 'giro') {
      if (!filters.from || !filters.to) {
        setError('Informe o período de e até.');
        return;
      }
    }
    setError(null);
    const title = productsReportTitle(filters.variant);
    openProductsReportPrint(filters, title, returnHref);
  }

  const needsLocations =
    filters.variant === 'saldo_fisico' || filters.variant === 'saldo_financeiro';
  const selectedVariant = PRODUCTS_REPORT_VARIANTS.find((v) => v.id === filters.variant);

  return (
    <div className="space-y-4">
      <ErrorBox message={error} />
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          {PRODUCTS_REPORT_VARIANTS.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="products-report-variant"
                className="mt-1"
                checked={filters.variant === v.id}
                onChange={() => setVariant(v.id)}
              />
              <span>
                <span className="font-medium">{v.label}</span>
                {v.hint ? <span className="mt-0.5 block text-xs text-slate-500">{v.hint}</span> : null}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {filters.variant === 'giro' ? (
        <>
          <FilterPeriodRangeFields
            idPrefix="prod-report"
            from={filters.from}
            to={filters.to}
            onFromChange={(from) => patch({ from })}
            onToChange={(to) => patch({ to })}
          />
          <p className="text-xs text-slate-500">Período obrigatório. Considera vendas com pedido confirmado.</p>
        </>
      ) : null}

      {needsLocations ? (
        <Field label="Locais de estoque">
          {locations.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhum local cadastrado. Cadastre em Cadastros gerais → Locais de estoque. Sem seleção, o relatório
              consolida todos os locais.
            </p>
          ) : (
            <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border border-slate-200 bg-white p-3">
              <p className="text-xs text-slate-500">
                Marque um ou mais locais. Deixe tudo desmarcado para consolidar todos os locais.
              </p>
              {locations.filter((l) => l.isActive !== false).map((l) => (
                <label key={l.id} className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="size-4 shrink-0 rounded border-slate-300"
                    checked={filters.stockLocationIds.includes(l.id)}
                    onChange={() => toggleLocation(l.id)}
                  />
                  {l.code} — {l.name}
                </label>
              ))}
            </div>
          )}
        </Field>
      ) : null}

      {selectedVariant?.hint && filters.variant === 'geral' ? (
        <p className="text-xs text-slate-500">{selectedVariant.hint}</p>
      ) : null}

      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
