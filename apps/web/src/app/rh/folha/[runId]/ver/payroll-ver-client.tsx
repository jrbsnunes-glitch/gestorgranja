'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { apiFetch } from '@/lib/api';
import {
  buildPayrollPrintBody,
  formatYearMonthPtBR,
  PAYROLL_PRINT_STYLES,
  type PayrollPrintDocument,
} from '@/lib/payroll-print';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

export function PayrollVerClient() {
  const params = useParams<{ runId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const runId = params.runId;
  const returnTo = searchParams.get('returnTo') || '/rh/folha';

  const [doc, setDoc] = useState<PayrollPrintDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    void apiFetch<PayrollPrintDocument>(`/v1/hr/reports/payroll/${runId}/print`)
      .then(setDoc)
      .catch((err) => {
        setDoc(null);
        setError(err instanceof Error ? err.message : 'Erro ao carregar folha');
      })
      .finally(() => setLoading(false));
  }, [runId]);

  useEffect(() => {
    load();
  }, [load]);

  useReportAutoPrint(!!doc && !loading);

  function goBack() {
    router.push(returnTo);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white p-6 text-sm text-slate-600">
        Carregando folha…
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen bg-white p-6">
        <p className="mb-4 text-sm text-red-600">{error ?? 'Folha não encontrada'}</p>
        <Button type="button" variant="secondary" onClick={goBack}>
          Voltar
        </Button>
      </div>
    );
  }

  const bodyHtml = buildPayrollPrintBody(doc);
  const title = `Folha ${formatYearMonthPtBR(doc.run.yearMonth)}`;

  return (
    <div className="payroll-print-page">
      <style dangerouslySetInnerHTML={{ __html: PAYROLL_PRINT_STYLES }} />
      <div className="payroll-print-sheet">
        {doc.printWarnings && doc.printWarnings.length ? (
          <div className="no-print mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {doc.printWarnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        ) : null}
        <div className="payroll-view-toolbar no-print">
          <div>
            <p className="text-sm font-semibold text-slate-800">{title}</p>
            <p className="text-xs text-slate-500">
              Formato A4 — margens de 20 mm. Na impressão, ative &quot;Gráficos de fundo&quot; se o navegador
              ocultar cores.
            </p>
          </div>
          <div className="actions">
            <Button type="button" variant="secondary" onClick={goBack}>
              Voltar
            </Button>
          </div>
        </div>
        <div className="payroll-print-root" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </div>
  );
}
