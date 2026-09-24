'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';

function PrintBody() {
  const sp = useSearchParams();
  const title = sp.get('title') ?? 'Relatório';
  const module = sp.get('module') ?? 'geral';

  return (
    <div className="mx-auto max-w-4xl p-6 print:p-0">
      <StandardReportHeader
        documentTitle={title}
        documentExtras={
          <p className="mt-1 text-sm text-slate-600">
            Módulo: {module}. Implementação de dados na Fase 2 — ver docs/reports-phase2-backlog.md.
          </p>
        }
      />
      <p className="text-sm text-slate-500">
        Configure filtros no modal Relatórios da tela de origem; esta rota receberá os parâmetros via query string.
      </p>
    </div>
  );
}

export default function RelatorioImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">Carregando…</p>}>
      <PrintBody />
    </Suspense>
  );
}
