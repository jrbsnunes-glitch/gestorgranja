'use client';

import { useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud';
import { RowActions } from '@/components/list-crud';
import { PersonalBillDescription } from '@/components/agenda/personal-bill-kind';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';
import {
  payablesDashboardKpis,
  payableStatusLabel,
  payableStatusTone,
  upcomingPayables,
  type PayableDashRow,
} from '@/lib/payables-dashboard';

function KpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: 'rose' | 'amber' | 'slate';
}) {
  const cls =
    tone === 'rose'
      ? 'border-red-200 bg-red-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-xl border px-4 py-3 shadow-sm ${cls}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      {hint ? <p className="text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function StatusBadge({ row }: { row: PayableDashRow }) {
  const tone = payableStatusTone(row);
  const cls =
    tone === 'paid'
      ? 'bg-emerald-100 text-emerald-900'
      : tone === 'overdue'
        ? 'bg-red-100 text-red-800'
        : tone === 'soon'
          ? 'bg-amber-100 text-amber-950'
          : 'bg-yellow-50 text-yellow-900 ring-1 ring-yellow-200';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {payableStatusLabel(row)}
    </span>
  );
}

export function PayablesWorkspace({
  payables,
  onView,
  onEdit,
  onPay,
  onApprove,
  onCancel,
  canEdit,
  canPay,
  ddaOpen,
  onDdaOpenChange,
}: {
  payables: PayableDashRow[];
  onView: (p: PayableDashRow) => void;
  onEdit: (p: PayableDashRow) => void;
  onPay: (p: PayableDashRow) => void;
  onApprove: (p: PayableDashRow) => void;
  onCancel: (p: PayableDashRow) => void;
  canEdit: (p: PayableDashRow) => boolean;
  canPay: (p: PayableDashRow) => boolean;
  ddaOpen: boolean;
  onDdaOpenChange: (open: boolean) => void;
}) {
  const [mainTab, setMainTab] = useState<'list' | 'boletos'>('list');
  const [selected, setSelected] = useState<string[]>([]);

  const kpis = useMemo(() => payablesDashboardKpis(payables), [payables]);
  const upcoming = useMemo(() => upcomingPayables(payables), [payables]);

  const toggleRow = (id: string, on: boolean) => {
    setSelected((prev) => (on ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Vence hoje"
          value={formatBrl(kpis.dueToday)}
          hint={`${kpis.dueTodayCount} despesa(s)`}
          tone="rose"
        />
        <KpiCard
          label="Vencidos"
          value={formatBrl(kpis.overdue)}
          hint={`${kpis.overdueCount} despesa(s)`}
          tone="rose"
        />
        <KpiCard
          label="Vencem em 3 dias"
          value={formatBrl(kpis.dueIn3)}
          hint={`${kpis.dueIn3Count} despesa(s)`}
          tone="amber"
        />
        <KpiCard label="Total do mês" value={formatBrl(kpis.monthTotal)} tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex border-b border-slate-100">
              <button
                type="button"
                className={`px-4 py-3 text-sm font-medium ${
                  mainTab === 'list'
                    ? 'border-b-2 border-emerald-700 text-emerald-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setMainTab('list')}
              >
                Contas a pagar
              </button>
              <button
                type="button"
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium ${
                  mainTab === 'boletos'
                    ? 'border-b-2 border-emerald-700 text-emerald-900'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => setMainTab('boletos')}
              >
                Boletos para conferência
                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">0</span>
              </button>
            </div>

            {mainTab === 'list' ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-2.5" aria-label="Selecionar" />
                      <th className="px-3 py-2.5">Descrição</th>
                      <th className="px-3 py-2.5">Fornecedor</th>
                      <th className="px-3 py-2.5">Vencimento</th>
                      <th className="px-3 py-2.5 text-right">Valor</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payables.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-10 text-center text-slate-500">
                          Nenhuma despesa para os filtros atuais.
                        </td>
                      </tr>
                    ) : (
                      payables.map((p) => (
                        <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300"
                              checked={selected.includes(p.id)}
                              onChange={(e) => toggleRow(p.id, e.target.checked)}
                            />
                          </td>
                          <td className="px-3 py-2.5 text-slate-900">
                            {p.expenseType ? (
                              <PersonalBillDescription kind={p.expenseType.iconKey} description={p.description} />
                            ) : (
                              p.description
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-slate-700">{p.partner.name}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatCalendarDatePtBR(p.dueDate)}</td>
                          <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                            {formatBrl(Number(p.amount))}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusBadge row={p} />
                          </td>
                          <td className="px-3 py-2.5">
                            <div className="flex flex-wrap items-center gap-1">
                              {p.approvalStatus === 'PENDING' ? (
                                <Button
                                  type="button"
                                  className="px-2 py-1 text-xs"
                                  onClick={() => onApprove(p)}
                                >
                                  Aprovar
                                </Button>
                              ) : null}
                              {canPay(p) ? (
                                <Button
                                  type="button"
                                  className="px-2 py-1 text-xs"
                                  onClick={() => onPay(p)}
                                  title="Registrar pagamento"
                                >
                                  ✓
                                </Button>
                              ) : null}
                              <RowActions
                                onView={() => onView(p)}
                                onEdit={canEdit(p) ? () => onEdit(p) : undefined}
                                onDelete={canEdit(p) ? () => onCancel(p) : undefined}
                              />
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                  Mostrando {payables.length} despesa(s)
                  {selected.length > 0 ? ` · ${selected.length} selecionada(s)` : ''}
                </p>
              </div>
            ) : (
              <div className="space-y-3 p-6 text-sm text-slate-600">
                <p className="font-medium text-slate-900">Boletos para conferência</p>
                <p>
                  Ainda não há boletos de fornecedores importados para conferência. Quando a integração DDA
                  estiver ativa, os títulos recebidos do banco aparecerão aqui para vincular às contas a pagar.
                </p>
                <Button type="button" variant="secondary" onClick={() => onDdaOpenChange(true)}>
                  Saiba mais sobre DDA
                </Button>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Próximos vencimentos</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma despesa em aberto.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcoming.map((p) => (
                  <li key={p.id} className="flex justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
                    <span className="min-w-0 truncate text-slate-800">
                      <span className="tabular-nums text-slate-500">
                        {formatCalendarDatePtBR(p.dueDate).slice(0, 5)}
                      </span>{' '}
                      {p.description}
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatBrl(Number(p.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Boletos para conferência</h3>
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs">0</span>
            </div>
            <p className="text-sm text-slate-500">Nenhum boleto aguardando conferência.</p>
            <Button
              type="button"
              variant="secondary"
              className="mt-3 w-full"
              onClick={() => setMainTab('boletos')}
            >
              Ver todos os boletos
            </Button>
          </div>
        </aside>
      </div>

      <FormCadastroModal
        open={ddaOpen}
        onClose={() => onDdaOpenChange(false)}
        title="Consultar boletos DDA"
        footer={
          <Button type="button" variant="secondary" onClick={() => onDdaOpenChange(false)}>
            Fechar
          </Button>
        }
      >
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            <strong>DDA (Débito Direto Autorizado)</strong> permite consultar boletos emitidos contra o CNPJ da
            granja no internet banking / API do banco, antes do pagamento.
          </p>
          <p>
            <strong>O que o GestorGranja já tem:</strong> integração Sicoob para <em>emitir</em> boletos de{' '}
            <em>contas a receber</em>, PDF, linha digitável e conciliação automática quando o cliente paga.
          </p>
          <p>
            <strong>O que falta para Contas a pagar:</strong> modelo de dados para boletos de terceiros (fornecedor,
            valor, vencimento, linha digitável), job de consulta DDA (Sicoob ou outro banco), fila &quot;para
            conferência&quot; (associar a fornecedor e criar/vincular título a pagar) e fluxo de aprovação antes do
            pagamento.
          </p>
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">
            Próximo passo sugerido: configurar credenciais em Financeiro → Bancos e implementar endpoint de
            sincronização DDA conforme manual da cooperativa.
          </p>
        </div>
      </FormCadastroModal>
    </div>
  );
}
