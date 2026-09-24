import { navigateToReportPrint } from '@/lib/report-print-nav';

export type PurchaseOrdersReportVariant = 'pedidos' | 'produtos_por_pedido';

export type PurchaseOrdersReportFilters = {
  variant: PurchaseOrdersReportVariant;
  from: string;
  to: string;
  controlMin: string;
  controlMax: string;
  partnerId: string;
};

export const PURCHASE_ORDERS_REPORT_VARIANTS: {
  id: PurchaseOrdersReportVariant;
  label: string;
  hint: string;
}[] = [
  {
    id: 'pedidos',
    label: 'Resumo por pedido',
    hint: 'Uma linha por pedido de compra (requisição, fornecedor, valores e situação).',
  },
  {
    id: 'produtos_por_pedido',
    label: 'Produtos por pedido',
    hint: 'Detalha cada produto vinculado ao pedido (quando houver itens cadastrados).',
  },
];

export function purchaseOrdersReportTitle(variant: PurchaseOrdersReportVariant): string {
  return variant === 'produtos_por_pedido'
    ? 'Compras — produtos por pedido'
    : 'Compras — pedidos';
}

export function defaultPurchaseOrdersReportFilters(
  variant: PurchaseOrdersReportVariant = 'pedidos',
): PurchaseOrdersReportFilters {
  const d = new Date();
  const to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const from = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  return {
    variant,
    from,
    to,
    controlMin: '',
    controlMax: '',
    partnerId: '',
  };
}

export function buildPurchaseOrdersReportSearchParams(
  filters: PurchaseOrdersReportFilters,
): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
  if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  if (filters.partnerId) p.set('partnerId', filters.partnerId);
  return p;
}

export function buildPurchaseOrdersReportApiPath(filters: PurchaseOrdersReportFilters): string {
  return `/v1/reports/purchase-orders?${buildPurchaseOrdersReportSearchParams(filters).toString()}`;
}

export function openPurchaseOrdersReportPrint(
  filters: PurchaseOrdersReportFilters,
  returnHref?: string,
) {
  const qs = buildPurchaseOrdersReportSearchParams(filters);
  qs.set('title', purchaseOrdersReportTitle(filters.variant));
  navigateToReportPrint(`/relatorios/compras/pedidos/impressao?${qs.toString()}`, returnHref);
}
