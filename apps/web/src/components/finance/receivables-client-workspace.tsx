'use client';

import { useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { RowActions } from '@/components/list-crud';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { openCollectionReportPrint } from '@/lib/collection-report-nav';
import { formatBrl } from '@/lib/money';
import {
  groupOpenReceivablesByClient,
  partnerDocumentLabel,
  partnerInitials,
  partnerPhoneLabel,
  receivableOpenBalance,
  receivablesKpis,
  isReceivableOverdue,
  type ReceivableForGrouping,
} from '@/lib/receivables-client-group';

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'blue' | 'rose' | 'amber' | 'emerald';
}) {
  const cls =
    tone === 'rose'
      ? 'border-red-200 bg-red-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-sky-200 bg-sky-50';
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${cls}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function ClientStatusPill({ overdueCount, openCount }: { overdueCount: number; openCount: number }) {
  if (overdueCount > 0) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
        {overdueCount} vencida{overdueCount === 1 ? '' : 's'}
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
      A vencer
    </span>
  );
}

function TitleSituationBadge({ dueDate, settled }: { dueDate: string; settled: boolean }) {
  const overdue = isReceivableOverdue(dueDate, settled);
  if (overdue) {
    return (
      <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
        Vencida
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
      A vencer
    </span>
  );
}

export function ReceivablesClientWorkspace({
  receivables,
  onViewTitle,
  onEditTitle,
  onViewBoleto,
  canEditTitle,
  hasBoletoLink,
}: {
  receivables: ReceivableForGrouping[];
  onViewTitle: (r: ReceivableForGrouping) => void;
  onEditTitle: (r: ReceivableForGrouping) => void;
  onViewBoleto: (boletoId: string) => void;
  canEditTitle: (r: ReceivableForGrouping) => boolean;
  hasBoletoLink: (r: ReceivableForGrouping) => boolean;
}) {
  const clientGroups = useMemo(() => groupOpenReceivablesByClient(receivables), [receivables]);
  const kpis = useMemo(() => receivablesKpis(receivables, clientGroups), [receivables, clientGroups]);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [detailPartnerId, setDetailPartnerId] = useState<string | null>(null);

  const detailGroup = useMemo(
    () => clientGroups.find((g) => g.partnerId === detailPartnerId) ?? null,
    [clientGroups, detailPartnerId],
  );

  function togglePartner(partnerId: string, checked: boolean) {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(partnerId) ? prev : [...prev, partnerId];
      return prev.filter((id) => id !== partnerId);
    });
    if (checked) setDetailPartnerId(partnerId);
  }

  function exportCsv() {
    const groups =
      selectedIds.length > 0
        ? clientGroups.filter((g) => selectedIds.includes(g.partnerId))
        : clientGroups;
    const lines = ['Cliente;Documento;Contas;Total em aberto'];
    for (const g of groups) {
      lines.push(
        `"${g.partner.name.replace(/"/g, '""')}";"${partnerDocumentLabel(g.partner)}";${g.openCount};${g.totalOpen.toFixed(2).replace('.', ',')}`,
      );
    }
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'contas-a-receber-clientes.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const selectedCount = selectedIds.length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Total em aberto"
          value={formatBrl(kpis.totalOpen)}
          hint={`${kpis.openTitleCount} conta(s)`}
          tone="blue"
        />
        <KpiCard
          label="Total vencido"
          value={formatBrl(kpis.totalOverdue)}
          hint={`${kpis.overdueTitleCount} conta(s)`}
          tone="rose"
        />
        <KpiCard
          label="A vencer"
          value={formatBrl(kpis.dueSoon)}
          hint={`${kpis.dueSoonTitleCount} conta(s)`}
          tone="amber"
        />
        <KpiCard
          label="Clientes na lista"
          value={`${kpis.clientsListed}`}
          hint={`de ${kpis.clientsTotal} cliente(s) com títulos`}
          tone="emerald"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="secondary" onClick={exportCsv}>
          Exportar
        </Button>
        <Button
          type="button"
          disabled={selectedCount === 0}
          onClick={() => openCollectionReportPrint(selectedIds)}
        >
          Gerar relatório de cobrança
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className={`min-w-0 ${detailGroup ? 'xl:col-span-7' : 'xl:col-span-12'}`}>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                  <tr>
                    <th className="w-10 px-3 py-2.5" aria-label="Selecionar" />
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5 text-right">Total em aberto</th>
                    <th className="px-3 py-2.5 text-center">Contas</th>
                    <th className="px-3 py-2.5">Mais antiga</th>
                    <th className="px-3 py-2.5">Mais recente</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-slate-500">
                        Nenhum cliente com contas em aberto para os filtros atuais.
                      </td>
                    </tr>
                  ) : (
                    clientGroups.map((g) => {
                      const checked = selectedIds.includes(g.partnerId);
                      const active = detailPartnerId === g.partnerId;
                      return (
                        <tr
                          key={g.partnerId}
                          className={`border-t border-slate-100 ${active ? 'bg-emerald-50/50' : 'hover:bg-slate-50/80'}`}
                        >
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={checked}
                              onChange={(e) => togglePartner(g.partnerId, e.target.checked)}
                              aria-label={`Selecionar ${g.partner.name}`}
                            />
                          </td>
                          <td className="px-3 py-2.5 font-medium text-slate-900">{g.partner.name}</td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                            {formatBrl(g.totalOpen)}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums">{g.openCount}</td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-600">
                            {formatCalendarDatePtBR(g.oldestDue)}
                          </td>
                          <td className="px-3 py-2.5 tabular-nums text-slate-600">
                            {formatCalendarDatePtBR(g.newestDue)}
                          </td>
                          <td className="px-3 py-2.5">
                            <ClientStatusPill overdueCount={g.overdueCount} openCount={g.openCount} />
                          </td>
                          <td className="px-3 py-2.5">
                            <Button
                              type="button"
                              variant="secondary"
                              className="px-2 py-1 text-xs"
                              onClick={() => {
                                setDetailPartnerId(g.partnerId);
                                if (!checked) togglePartner(g.partnerId, true);
                              }}
                            >
                              Detalhes
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {selectedCount > 0 ? (
              <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                {selectedCount} cliente(s) selecionado(s)
              </p>
            ) : null}
          </div>
        </div>

        {detailGroup ? (
          <aside className="xl:col-span-5">
            <div className="sticky top-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-base font-semibold text-slate-900">Detalhes do cliente</h3>
                <button
                  type="button"
                  className="text-sm text-slate-500 hover:text-slate-800"
                  onClick={() => setDetailPartnerId(null)}
                >
                  Fechar
                </button>
              </div>

              <div className="space-y-4 p-4">
                <div className="flex gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900">
                    {partnerInitials(detailGroup.partner.name)}
                  </div>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-slate-900">{detailGroup.partner.name}</p>
                    <p className="text-slate-600">
                      Código: {detailGroup.partner.controlNumber ?? '—'} | CPF/CNPJ:{' '}
                      {partnerDocumentLabel(detailGroup.partner)}
                    </p>
                    <p className="text-slate-600">Telefone: {partnerPhoneLabel(detailGroup.partner)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg border border-sky-100 bg-sky-50 px-2 py-2">
                    <p className="text-slate-600">Total em aberto</p>
                    <p className="mt-0.5 font-bold tabular-nums text-sky-900">
                      {formatBrl(detailGroup.totalOpen)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 px-2 py-2">
                    <p className="text-slate-600">Contas</p>
                    <p className="mt-0.5 font-bold tabular-nums text-amber-950">{detailGroup.openCount}</p>
                  </div>
                  <div className="rounded-lg border border-red-100 bg-red-50 px-2 py-2">
                    <p className="text-slate-600">Vencidas</p>
                    <p className="mt-0.5 font-bold tabular-nums text-red-800">{detailGroup.overdueCount}</p>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-800">Contas em aberto do cliente</h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="min-w-full text-xs">
                      <thead className="bg-slate-50 text-left text-slate-500">
                        <tr>
                          <th className="px-2 py-2">Nº Venda</th>
                          <th className="px-2 py-2">Data da venda</th>
                          <th className="px-2 py-2">Vencimento</th>
                          <th className="px-2 py-2 text-right">Valor</th>
                          <th className="px-2 py-2">Situação</th>
                          <th className="px-2 py-2">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailGroup.titles.map((t) => {
                          const saleNo = t.salesOrder?.controlNumber;
                          const overdue = isReceivableOverdue(t.dueDate, t.settled === true);
                          const boletoId = t.boletos?.[0]?.id;
                          return (
                            <tr key={t.id} className="border-t border-slate-100">
                              <td className="px-2 py-2 tabular-nums">
                                {saleNo != null ? `#${saleNo}` : t.controlNumber != null ? `#${t.controlNumber}` : '—'}
                              </td>
                              <td className="px-2 py-2 tabular-nums">
                                {t.salesOrder?.orderDate
                                  ? formatCalendarDatePtBR(t.salesOrder.orderDate)
                                  : '—'}
                              </td>
                              <td
                                className={`px-2 py-2 tabular-nums ${overdue ? 'font-semibold text-red-700' : 'text-slate-700'}`}
                              >
                                {formatCalendarDatePtBR(t.dueDate)}
                              </td>
                              <td className="px-2 py-2 text-right font-medium tabular-nums">
                                {formatBrl(receivableOpenBalance(t))}
                              </td>
                              <td className="px-2 py-2">
                                <TitleSituationBadge dueDate={t.dueDate} settled={t.settled === true} />
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex flex-wrap items-center gap-1">
                                  {boletoId && hasBoletoLink(t) ? (
                                    <button
                                      type="button"
                                      className="text-emerald-800 hover:underline"
                                      onClick={() => onViewBoleto(boletoId)}
                                    >
                                      Boleto
                                    </button>
                                  ) : null}
                                  <RowActions
                                    onView={() => onViewTitle(t)}
                                    onEdit={canEditTitle(t) ? () => onEditTitle(t) : undefined}
                                  />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
