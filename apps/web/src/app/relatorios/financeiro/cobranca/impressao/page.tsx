'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { StandardReportHeader } from '@/components/crud/standard-report-header';
import { ReportPrintActions } from '@/components/report-print-actions';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';
import { useReportAutoPrint } from '@/lib/use-report-auto-print';

type CollectionReport = {
  partnerCount: number;
  grandTotalOpen: number;
  clients: {
    partnerId: string;
    name: string;
    partnerControlNumber: number;
    document: string | null;
    phone: string | null;
    totalOpen: number;
    titles: {
      receivableControlNumber: number;
      salesControlNumber: number | null;
      saleDate: string | null;
      dueDate: string;
      balance: number;
      situation: 'overdue' | 'due';
    }[];
  }[];
};

function CollectionReportBody() {
  const sp = useSearchParams();
  const partnerIds = sp.get('partnerIds') ?? '';
  const [data, setData] = useState<CollectionReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!partnerIds.trim()) {
      setError('Nenhum cliente selecionado.');
      return;
    }
    void apiFetch<CollectionReport>(`/v1/reports/collection?partnerIds=${encodeURIComponent(partnerIds)}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao gerar relatório'));
  }, [partnerIds]);

  useReportAutoPrint(data != null);

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="mx-auto max-w-4xl p-6 print:p-0">
      <ReportPrintActions />
      <StandardReportHeader
        documentTitle="Relatório de Cobrança"
        documentExtras={
          <p className="text-sm text-slate-600">Contas a Receber — Clientes selecionados</p>
        }
      />

      {error ? (
        <p className="text-red-700">{error}</p>
      ) : !data ? (
        <p>Carregando…</p>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap justify-between gap-2 text-xs text-slate-500 print:text-[10px]">
            <span>
              Clientes selecionados: <strong className="text-slate-800">{data.partnerCount}</strong>
            </span>
            <span>Situação: Em aberto (vencidas e a vencer)</span>
            <span>
              Emissão: {dateStr} {timeStr}
            </span>
          </div>

          <div className="space-y-4">
            {data.clients.map((c) => (
              <section
                key={c.partnerId}
                className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/80 print:break-inside-avoid"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{c.name}</h2>
                    <p className="text-sm text-slate-600">
                      Código: {String(c.partnerControlNumber).padStart(5, '0')} | CPF/CNPJ:{' '}
                      {c.document ?? '—'}
                    </p>
                    <p className="text-sm text-slate-600">Telefone: {c.phone ?? '—'}</p>
                  </div>
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-right">
                    <p className="text-xs text-red-800">Total em aberto</p>
                    <p className="text-lg font-bold tabular-nums text-red-800">{formatBrl(c.totalOpen)}</p>
                  </div>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-white text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Nº Venda</th>
                      <th className="px-4 py-2">Data da venda</th>
                      <th className="px-4 py-2">Vencimento</th>
                      <th className="px-4 py-2 text-right">Valor</th>
                      <th className="px-4 py-2">Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.titles.map((t) => {
                      const overdue = t.situation === 'overdue';
                      return (
                        <tr key={`${c.partnerId}-${t.receivableControlNumber}`} className="border-t border-slate-200">
                          <td className="px-4 py-2 tabular-nums">
                            #{t.salesControlNumber ?? t.receivableControlNumber}
                          </td>
                          <td className="px-4 py-2 tabular-nums">
                            {t.saleDate ? formatCalendarDatePtBR(t.saleDate) : '—'}
                          </td>
                          <td
                            className={`px-4 py-2 tabular-nums ${overdue ? 'font-semibold text-red-700' : ''}`}
                          >
                            {formatCalendarDatePtBR(t.dueDate)}
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatBrl(t.balance)}</td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                                overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {overdue ? 'Vencida' : 'A vencer'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-4 text-center">
            <div>
              <p className="text-sm text-slate-600">Clientes listados</p>
              <p className="text-2xl font-bold text-slate-900">{data.partnerCount}</p>
            </div>
            <div className="border-l border-emerald-200">
              <p className="text-sm text-slate-600">Total em aberto</p>
              <p className="text-2xl font-bold text-slate-900">{formatBrl(data.grandTotalOpen)}</p>
            </div>
          </div>

          <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
            <span>Sistema de Gestão</span>
            <span>
              Relatório gerado em {dateStr} às {timeStr}
            </span>
          </footer>
        </>
      )}
    </div>
  );
}

export default function CollectionReportPrintPage() {
  return (
    <Suspense fallback={<p className="p-6">Carregando…</p>}>
      <CollectionReportBody />
    </Suspense>
  );
}
