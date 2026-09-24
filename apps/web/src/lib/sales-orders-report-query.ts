import { navigateToReportPrint } from '@/lib/report-print-nav';

export type SalesOrdersReportVariant = 'espelho' | 'periodo' | 'cliente' | 'produtos';

export type SalesOrdersReportFilters = {
  variant: SalesOrdersReportVariant;
  from: string;
  to: string;
  controlMin: string;
  controlMax: string;
  partnerId: string;
  productId: string;
  salesOrderId: string;
};

export const SALES_ORDERS_REPORT_VARIANTS: {
  id: SalesOrdersReportVariant;
  label: string;
  hint: string;
}[] = [
  {
    id: 'espelho',
    label: 'Espelho da venda',
    hint: 'Detalhe de uma venda (use a seleção na lista ou o número de controle).',
  },
  {
    id: 'periodo',
    label: 'Por período',
    hint: 'Lista de vendas no intervalo, com totais no rodapé.',
  },
  {
    id: 'cliente',
    label: 'Por cliente',
    hint: 'Vendas confirmadas agrupadas por cliente (totais no rodapé).',
  },
  {
    id: 'produtos',
    label: 'Por produtos',
    hint: 'Vendas confirmadas agrupadas por produto (totais no rodapé).',
  },
];

export function salesOrdersReportTitle(variant: SalesOrdersReportVariant): string {
  switch (variant) {
    case 'espelho':
      return 'Vendas — espelho da venda';
    case 'periodo':
      return 'Vendas — por período';
    case 'cliente':
      return 'Vendas — por cliente';
    case 'produtos':
      return 'Vendas — por produtos';
  }
}

export function defaultSalesOrdersReportFilters(
  variant: SalesOrdersReportVariant = 'periodo',
): SalesOrdersReportFilters {
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
    productId: '',
    salesOrderId: '',
  };
}

export function buildSalesOrdersReportSearchParams(filters: SalesOrdersReportFilters): URLSearchParams {
  const p = new URLSearchParams();
  p.set('variant', filters.variant);
  if (filters.from) p.set('from', filters.from);
  if (filters.to) p.set('to', filters.to);
  if (filters.controlMin.trim()) p.set('controlMin', filters.controlMin.trim());
  if (filters.controlMax.trim()) p.set('controlMax', filters.controlMax.trim());
  if (filters.partnerId) p.set('partnerId', filters.partnerId);
  if (filters.productId) p.set('productId', filters.productId);
  if (filters.salesOrderId) p.set('salesOrderId', filters.salesOrderId);
  return p;
}

export function buildSalesOrdersReportApiPath(filters: SalesOrdersReportFilters): string {
  return `/v1/reports/sales-orders?${buildSalesOrdersReportSearchParams(filters).toString()}`;
}

export function openSalesOrdersReportPrint(filters: SalesOrdersReportFilters, returnHref?: string) {
  const qs = buildSalesOrdersReportSearchParams(filters);
  qs.set('title', salesOrdersReportTitle(filters.variant));
  navigateToReportPrint(`/relatorios/vendas/impressao?${qs.toString()}`, returnHref);
}

export function openSalesOrderEspelhoPrint(salesOrderId: string, returnHref?: string) {
  openSalesOrdersReportPrint(
    {
      ...defaultSalesOrdersReportFilters('espelho'),
      variant: 'espelho',
      salesOrderId,
    },
    returnHref,
  );
}
