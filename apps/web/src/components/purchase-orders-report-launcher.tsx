'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import {
  FilterControlRangeFields,
  FilterPeriodRangeFields,
} from '@/components/crud/filter-fields';
import { PartnerSearchField } from '@/components/partner-search-field';
import { apiFetch } from '@/lib/api';
import {
  defaultPurchaseOrdersReportFilters,
  openPurchaseOrdersReportPrint,
  PURCHASE_ORDERS_REPORT_VARIANTS,
  type PurchaseOrdersReportFilters,
  type PurchaseOrdersReportVariant,
} from '@/lib/purchase-orders-report-query';

type Partner = { id: string; name: string; tradeName?: string | null; isSupplier?: boolean };

export function PurchaseOrdersReportLauncher({ returnHref }: { returnHref?: string }) {
  const [filters, setFilters] = useState<PurchaseOrdersReportFilters>(() =>
    defaultPurchaseOrdersReportFilters(),
  );
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
  }, []);

  const suppliers = useMemo(
    () => partners.filter((p) => p.isSupplier !== false).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [partners],
  );

  function patch(partial: Partial<PurchaseOrdersReportFilters>) {
    setFilters((f) => ({ ...f, ...partial }));
  }

  function setVariant(variant: PurchaseOrdersReportVariant) {
    setFilters((f) => ({ ...f, variant }));
  }

  function generate() {
    openPurchaseOrdersReportPrint(filters, returnHref);
  }

  return (
    <div className="space-y-4">
      <fieldset className="rounded-md border border-slate-200 bg-white p-3">
        <legend className="px-1 text-sm font-medium text-slate-700">Tipo de relatório</legend>
        <div className="mt-1 flex flex-col gap-2">
          {PURCHASE_ORDERS_REPORT_VARIANTS.map((v) => (
            <label key={v.id} className="flex cursor-pointer items-start gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="purchase-orders-report-variant"
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
        idPrefix="po-period"
        from={filters.from}
        to={filters.to}
        onFromChange={(from) => patch({ from })}
        onToChange={(to) => patch({ to })}
        fromLabel="Período de"
        toLabel="Período até"
      />
      <p className="text-xs text-slate-500">Filtra pela data em que o pedido foi gerado.</p>
      <FilterControlRangeFields
        idPrefix="po-ctrl"
        controlMin={filters.controlMin}
        controlMax={filters.controlMax}
        onControlMinChange={(controlMin) => patch({ controlMin })}
        onControlMaxChange={(controlMax) => patch({ controlMax })}
      />
      <PartnerSearchField
        partners={suppliers}
        partnerId={filters.partnerId}
        label="Fornecedor"
        placeholder="Pesquisar fornecedor…"
        onPartnerIdChange={(partnerId) => patch({ partnerId })}
      />
      <Button type="button" className="w-full sm:w-auto" onClick={generate}>
        Gerar relatório
      </Button>
    </div>
  );
}
