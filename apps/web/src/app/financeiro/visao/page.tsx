'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro } from '@/components/crud';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { humanizeUserText } from '@/lib/humanize-user-text';
import { errorMessage } from '@/lib/labels';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type DailyFlowPoint = {
  date: string;
  entradas: number;
  saidas: number;
  crAVencer: number;
  cpAVencer: number;
};

type BudgetProgressRow = {
  id: string;
  amountPlanned: number;
  actual: number;
  usedPct: number | null;
  remaining: number;
  chartAccount: { code: string; name: string };
};

type Dashboard = {
  payables: { open: number; overdue: number; dueNext7: number; dueNext30: number };
  receivables: { open: number; overdue: number; dueNext7: number; dueNext30: number };
  topClients: { partnerName: string; openBalance: number; sharePct: number }[];
  dailyFlow: DailyFlowPoint[];
  alerts: { id: string; title: string; message: string; type: string }[];
  budgetYearMonth?: string;
  budgetProgress?: BudgetProgressRow[];
};

function formatChartDate(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

type AlertSettings = {
  minCashBalance: string;
  enableReceivableOverdue: boolean;
  enablePaymentDue: boolean;
  enableBudgetPace: boolean;
  enablePurchaseImpact: boolean;
  purchaseImpactThresholdPct: string;
  budgetPaceWarningPct: string;
};

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function FinanceiroVisaoPage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AlertSettings | null>(null);

  const load = useCallback(() => {
    void apiFetch<Dashboard>('/v1/finance/dashboard')
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openSettings() {
    setSettingsOpen(true);
    const s = await apiFetch<AlertSettings>('/v1/finance/alert-settings');
    setSettings(s);
  }

  async function saveSettings(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await apiFetch('/v1/finance/alert-settings', {
      method: 'PATCH',
      body: JSON.stringify({
        minCashBalance: Number(fd.get('minCashBalance')),
        enableReceivableOverdue: fd.get('enableReceivableOverdue') === 'on',
        enablePaymentDue: fd.get('enablePaymentDue') === 'on',
        enableBudgetPace: fd.get('enableBudgetPace') === 'on',
        enablePurchaseImpact: fd.get('enablePurchaseImpact') === 'on',
        purchaseImpactThresholdPct: Number(fd.get('purchaseImpactThresholdPct')),
        budgetPaceWarningPct: Number(fd.get('budgetPaceWarningPct')),
      }),
    });
    setSettingsOpen(false);
    load();
  }

  return (
    <AdminShell title="Financeiro — Visão">
      <PageIntro
        title="Visão financeira"
        description="Títulos em aberto, alertas e concentração de recebimentos. Para saldo e movimentação de caixa, use a aba Fluxo."
      />
      <ErrorBox message={error} />
      <div className="mb-4">
        <Button type="button" variant="secondary" onClick={() => void openSettings()}>
          Configurar alertas
        </Button>
      </div>
      {data ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <PageCard title="CP em aberto">
              <p className="text-2xl font-semibold text-slate-900">{money(data.payables.open)}</p>
              <p className="text-xs text-slate-500">Vencidas: {money(data.payables.overdue)}</p>
            </PageCard>
            <PageCard title="CR em aberto">
              <p className="text-2xl font-semibold text-slate-900">{money(data.receivables.open)}</p>
              <p className="text-xs text-slate-500">Vencidas: {money(data.receivables.overdue)}</p>
            </PageCard>
            <PageCard title="Próx. 7 dias">
              <p className="text-sm text-slate-600">Saídas CP: {money(data.payables.dueNext7)}</p>
              <p className="text-sm text-slate-600">Entradas CR: {money(data.receivables.dueNext7)}</p>
            </PageCard>
          </div>
          {data.budgetProgress && data.budgetProgress.length > 0 ? (
            <PageCard title={`Orçamento vs realizado — ${data.budgetYearMonth ?? ''}`}>
              <ul className="space-y-3 text-sm">
                {data.budgetProgress.map((b) => (
                  <li key={b.id}>
                    <div className="mb-1 flex flex-wrap justify-between gap-2">
                      <span className="text-slate-800">
                        {b.chartAccount.code} — {b.chartAccount.name}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {money(b.actual)} / {money(b.amountPlanned)}
                        {b.usedPct != null ? ` (${b.usedPct}%)` : ''}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full ${
                          (b.usedPct ?? 0) >= 100 ? 'bg-red-600' : (b.usedPct ?? 0) >= 85 ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}
                        style={{ width: `${Math.min(b.usedPct ?? 0, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3">
                <Link href="/financeiro/bancos">
                  <Button type="button" variant="secondary">
                    Gerenciar orçamento
                  </Button>
                </Link>
              </div>
            </PageCard>
          ) : null}
          <PageCard title="Entradas, saídas e vencimentos">
            <p className="mb-3 text-xs text-slate-500">
              Últimos 7 dias: recebimentos e pagamentos registrados. Próximos 30 dias: títulos em aberto com vencimento
              na data (CR e CP).
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.dailyFlow} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tickFormatter={formatChartDate} tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} width={56} />
                  <Tooltip
                    formatter={(v: number) => money(v)}
                    labelFormatter={(l) => `Data: ${formatChartDate(String(l))}`}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="entradas" name="Entradas (recebidas)" fill="#059669" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="saidas" name="Saídas (pagas)" fill="#e11d48" radius={[2, 2, 0, 0]} />
                  <Line
                    type="monotone"
                    dataKey="crAVencer"
                    name="CR a vencer"
                    stroke="#047857"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 3"
                  />
                  <Line
                    type="monotone"
                    dataKey="cpAVencer"
                    name="CP a vencer"
                    stroke="#be123c"
                    strokeWidth={2}
                    dot={false}
                    strokeDasharray="4 3"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </PageCard>
          <PageCard title="Caixa e projeção">
            <p className="mb-3 text-sm text-slate-600">
              O saldo exibido em <strong className="font-medium text-slate-800">Bancos</strong> é informado manualmente e{' '}
              <strong className="font-medium text-slate-800">não</strong> acompanha cada pagamento ou recebimento
              automaticamente. Para ver entradas, saídas e saldo acumulado no período (com CP, CR, caixa e compras
              previstas), use o fluxo de caixa.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/financeiro/fluxo">
                <Button type="button">Abrir fluxo de caixa</Button>
              </Link>
              <Link href="/financeiro/bancos">
                <Button type="button" variant="secondary">
                  Atualizar saldos em Bancos
                </Button>
              </Link>
            </div>
          </PageCard>
          <PageCard title="Concentração — clientes (CR)">
            <ul className="space-y-2 text-sm">
              {data.topClients.length === 0 ? (
                <li className="text-slate-500">Nenhum título em aberto.</li>
              ) : (
                data.topClients.map((c) => (
                  <li key={c.partnerName} className="flex justify-between gap-2">
                    <span>{c.partnerName}</span>
                    <span className="tabular-nums text-slate-700">
                      {money(c.openBalance)} ({c.sharePct.toFixed(1)}%)
                    </span>
                  </li>
                ))
              )}
            </ul>
          </PageCard>
          <PageCard title="Alertas financeiros">
            <ul className="space-y-2 text-sm">
              {data.alerts.length === 0 ? (
                <li className="text-slate-500">Nenhum alerta aberto.</li>
              ) : (
                data.alerts.map((a) => (
                  <li key={a.id} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <p className="font-medium text-amber-900">{a.title}</p>
                    <p className="text-amber-800">{humanizeUserText(a.message)}</p>
                  </li>
                ))
              )}
            </ul>
            <Link href="/alertas" className="mt-3 inline-block text-sm text-emerald-700 hover:underline">
              Ver todos os alertas
            </Link>
          </PageCard>
        </>
      ) : null}
      <FormCadastroModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Configurar alertas financeiros"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setSettingsOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="alert-settings-form">
              Salvar
            </Button>
          </>
        }
      >
        {settings ? (
          <form id="alert-settings-form" onSubmit={saveSettings} className="space-y-3">
            <Field label="Limite mínimo caixa projetado (R$)">
              <input
                name="minCashBalance"
                type="number"
                step="0.01"
                className={inputClass}
                defaultValue={Number(settings.minCashBalance)}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enablePaymentDue" defaultChecked={settings.enablePaymentDue} />
              CP a vencer
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enableReceivableOverdue" defaultChecked={settings.enableReceivableOverdue} />
              CR atrasadas
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enableBudgetPace" defaultChecked={settings.enableBudgetPace} />
              Ritmo de orçamento
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="enablePurchaseImpact" defaultChecked={settings.enablePurchaseImpact} />
              Impacto de compras
            </label>
            <Field label="% limite impacto compra">
              <input
                name="purchaseImpactThresholdPct"
                type="number"
                step="0.1"
                className={inputClass}
                defaultValue={Number(settings.purchaseImpactThresholdPct)}
              />
            </Field>
            <Field label="% aviso orçamento">
              <input
                name="budgetPaceWarningPct"
                type="number"
                step="0.1"
                className={inputClass}
                defaultValue={Number(settings.budgetPaceWarningPct)}
              />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>
    </AdminShell>
  );
}
