'use client';

import { Button } from '@gestor-granja/ui';
import { navigateToReportPrint } from '@/lib/report-print-nav';

export function ReportLauncher({
  reportKey,
  title,
  extraParams,
}: {
  reportKey: string;
  title: string;
  extraParams?: Record<string, string>;
}) {
  function openReport() {
    const params = new URLSearchParams({ key: reportKey, title, module: reportKey, ...extraParams });
    navigateToReportPrint(`/relatorio?${params.toString()}`);
  }

  return (
    <Button type="button" variant="secondary" onClick={openReport}>
      Relatórios
    </Button>
  );
}
