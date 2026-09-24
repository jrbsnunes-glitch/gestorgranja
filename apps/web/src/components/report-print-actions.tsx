'use client';

import { Button } from '@gestor-granja/ui';
import { closeReportPrintView } from '@/lib/report-print-nav';

/** Barra de ações das telas de relatório (sem botão Imprimir — use Ctrl+P se necessário). */
export function ReportPrintActions() {
  return (
    <div className="mb-4 print:hidden">
      <Button type="button" variant="secondary" onClick={closeReportPrintView}>
        Voltar
      </Button>
    </div>
  );
}
