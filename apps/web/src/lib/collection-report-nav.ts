import { navigateToReportPrint } from '@/lib/report-print-nav';

export function openCollectionReportPrint(partnerIds: string[]) {
  const ids = [...new Set(partnerIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length === 0) return;
  const qs = new URLSearchParams();
  qs.set('partnerIds', ids.join(','));
  navigateToReportPrint(`/relatorios/financeiro/cobranca/impressao?${qs.toString()}`);
}
