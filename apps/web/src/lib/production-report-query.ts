import { navigateToReportPrint } from '@/lib/report-print-nav';

export type ProductionReportDomain =
  | 'postura'
  | 'mortalidade'
  | 'racao'
  | 'ambiente'
  | 'transferencia';

export type ProductionReportVariant = 'geral' | 'periodo' | 'lote' | 'totais';

export type ProductionReportFilters = {
  domain: ProductionReportDomain;
  variant: ProductionReportVariant;
  from: string;
  to: string;
  flockLotId: string;
};

export type ProductionReportVariantOption = {
  id: ProductionReportVariant;
  label: string;
};

export const PRODUCTION_REPORT_VARIANTS: Record<
  ProductionReportDomain,
  ProductionReportVariantOption[]
> = {
  postura: [
    { id: 'geral', label: 'Listagem Geral' },
    { id: 'periodo', label: 'Por período' },
    { id: 'lote', label: 'Por lote' },
    { id: 'totais', label: 'Totais de Postura' },
  ],
  mortalidade: [
    { id: 'geral', label: 'Listagem Geral' },
    { id: 'periodo', label: 'Por período' },
    { id: 'lote', label: 'Por lote' },
    { id: 'totais', label: 'Totais de Mortalidade' },
  ],
  racao: [
    { id: 'geral', label: 'Listagem Geral' },
    { id: 'periodo', label: 'Por período' },
    { id: 'lote', label: 'Por lote' },
    { id: 'totais', label: 'Totais de Ração' },
  ],
  ambiente: [{ id: 'geral', label: 'Listagem Geral' }],
  transferencia: [{ id: 'geral', label: 'Listagem Geral' }],
};

function monthStartIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function defaultProductionReportFilters(
  domain: ProductionReportDomain,
): ProductionReportFilters {
  return {
    domain,
    variant: 'geral',
    from: monthStartIso(),
    to: todayIso(),
    flockLotId: '',
  };
}

export function buildProductionReportSearchParams(filters: ProductionReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('domain', filters.domain);
  p.set('variant', filters.variant);
  if (filters.variant === 'periodo' || filters.variant === 'totais') {
    if (filters.from) p.set('from', filters.from);
    if (filters.to) p.set('to', filters.to);
  }
  if (filters.variant === 'lote' && filters.flockLotId.trim()) {
    p.set('flockLotId', filters.flockLotId.trim());
  }
  return p;
}

export function buildProductionReportApiPath(filters: ProductionReportFilters): string {
  return `/v1/reports/production-daily?${buildProductionReportSearchParams(filters).toString()}`;
}

export function openProductionReportPrint(
  filters: ProductionReportFilters,
  title: string,
  returnHref?: string,
) {
  const qs = buildProductionReportSearchParams(filters);
  qs.set('title', title);
  navigateToReportPrint(`/relatorios/producao/impressao?${qs.toString()}`, returnHref);
}

export function productionReportTitle(
  domain: ProductionReportDomain,
  variant: ProductionReportVariant,
): string {
  const opt = PRODUCTION_REPORT_VARIANTS[domain].find((v) => v.id === variant);
  return opt?.label ?? 'Relatório';
}
