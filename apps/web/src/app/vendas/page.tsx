'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro } from '@/components/crud';
import { MiniPdvModal } from '@/components/vendas/mini-pdv-modal';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatBrl } from '@/lib/money';
import { useRouter } from 'next/navigation';
import { cashSessionListHref } from '@/lib/cash-session-nav';
import { formatRecordControl } from '@/lib/record-control';
import { summarizeCashSession } from '@/lib/cash-session-summary';

type CashMovementRow = {
  id: string;
  type: string;
  isExpense?: boolean;
  amount: string;
  reason?: string | null;
  createdAt: string;
  chartAccount?: { code: string; name: string } | null;
};

type MyOpenCash = {
  id: string;
  controlNumber: number;
  openingBalance: string;
  openedAt: string;
  status: string;
  movements?: CashMovementRow[];
};

type RecentMove = {
  id: string;
  at: string;
  description: string;
  kind: string;
  amount: number;
  inflow: boolean;
  counterparty: string;
};

type OpenSessionListItem = {
  id: string;
  controlNumber: number;
  openedAt: string;
  openingBalance: string;
  status: string;
  isMine: boolean;
  user: { name: string; username: string };
};

type SalesPeriodStats = {
  count: number;
  totalAmount: number;
  noAto: number;
  requisicao: number;
  boleto: number;
};

function PaymentBreakdown({ stats }: { stats: SalesPeriodStats }) {
  const rows = [
    { label: 'No ato', value: stats.noAto, tone: 'text-emerald-800' },
    { label: 'Requisição', value: stats.requisicao, tone: 'text-slate-800' },
    { label: 'Boletos', value: stats.boleto, tone: 'text-amber-900' },
  ] as const;

  return (
    <ul className="mt-3 space-y-1.5 border-t border-emerald-200/60 pt-3 text-sm">
      {rows.map((r) => (
        <li key={r.label} className="flex items-baseline justify-between gap-4">
          <span className="text-slate-600">{r.label}</span>
          <span className={`tabular-nums font-medium ${r.tone}`}>{formatBrl(r.value)}</span>
        </li>
      ))}
    </ul>
  );
}

function recentCashMoves(session: MyOpenCash | null): RecentMove[] {
  if (!session) return [];
  const rows: RecentMove[] = [
    {
      id: 'opening',
      at: session.openedAt,
      description: 'Abertura de caixa',
      kind: 'Entrada',
      amount: Number(session.openingBalance),
      inflow: true,
      counterparty: '—',
    },
    ...(session.movements ?? []).map((m) => {
      const isIn = m.type === 'IN';
      const desc =
        m.reason?.trim() || (m.isExpense ? 'Despesa' : isIn ? 'Entrada' : 'Saída');
      return {
        id: m.id,
        at: m.createdAt,
        description: desc,
        kind: isIn ? 'Entrada' : m.isExpense ? 'Despesa' : 'Saída',
        amount: Number(m.amount),
        inflow: isIn,
        counterparty: m.isExpense ? m.chartAccount?.name?.trim() || '—' : '—',
      };
    }),
  ];
  return rows
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 5);
}

function formatMoveDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
}

function KpiMetricCard({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone: 'emerald' | 'sky' | 'rose';
  hint?: string;
}) {
  const styles =
    tone === 'sky'
      ? 'border-sky-200 bg-sky-50 text-sky-950'
      : tone === 'rose'
        ? 'border-red-200 bg-red-50 text-red-900'
        : 'border-emerald-200 bg-emerald-50 text-emerald-950';
  const valueTone =
    tone === 'sky' ? 'text-sky-900' : tone === 'rose' ? 'text-red-800' : 'text-emerald-900';

  return (
    <div className={`rounded-xl border px-4 py-4 shadow-sm ${styles}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums tracking-tight ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs opacity-70">{hint}</p> : null}
    </div>
  );
}

function MoveKindBadge({ kind, inflow }: { kind: string; inflow: boolean }) {
  const cls = inflow
    ? 'bg-emerald-100 text-emerald-900'
    : kind === 'Despesa'
      ? 'bg-amber-100 text-amber-950'
      : 'bg-red-100 text-red-900';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{kind}</span>
  );
}

function PeriodDashboard({
  title,
  stats,
  tone,
}: {
  title: string;
  stats: SalesPeriodStats;
  tone?: 'good' | 'default';
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-4 ${
        tone === 'good' ? 'border-emerald-200 bg-emerald-50/80' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{formatBrl(stats.totalAmount)}</p>
      <p className="text-xs text-slate-500">{stats.count} venda(s) confirmada(s) no caixa</p>
      <PaymentBreakdown stats={stats} />
    </div>
  );
}

export default function VendasPage() {
  const router = useRouter();
  const [myOpenCash, setMyOpenCash] = useState<MyOpenCash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [salesStats, setSalesStats] = useState<{ day: SalesPeriodStats; month: SalesPeriodStats } | null>(null);

  const myOpenRowToday = myOpenCash != null && myOpenCash.status === 'OPEN';
  const cashSummary = myOpenCash
    ? summarizeCashSession(myOpenCash.openingBalance, myOpenCash.movements ?? [])
    : null;
  const recentMoves = recentCashMoves(myOpenRowToday ? myOpenCash : null);
  const todayLabel = new Date().toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const myStaleOpens = useMemo(
    () => openSessions.filter((s) => s.isMine),
    [openSessions],
  );

  const load = useCallback(() => {
    void apiFetch<MyOpenCash | null>('/v1/cash/sessions/open/me').then(setMyOpenCash);
    void apiFetch<OpenSessionListItem[]>('/v1/cash/sessions/open/list').then(setOpenSessions);
    void apiFetch<{ day: SalesPeriodStats; month: SalesPeriodStats }>('/v1/commercial/stats')
      .then(setSalesStats)
      .catch(() => setSalesStats(null));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openOpenCashModal() {
    setError(null);
    setOpenCashModalOpen(true);
  }

  async function openCashSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/cash/sessions/open', {
        method: 'POST',
        body: JSON.stringify({ openingBalance: Number(fd.get('openingBalance')) }),
      });
      setOpenCashModalOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir caixa');
    }
  }

  function openSaleForm() {
    if (!myOpenRowToday) {
      setError('Abra o caixa antes de registrar vendas.');
      openOpenCashModal();
      return;
    }
    setError(null);
    setFormOpen(true);
  }

  function openExpenseForm() {
    if (!myOpenRowToday || !myOpenCash) {
      setError('Abra o caixa antes de lançar despesas.');
      openOpenCashModal();
      return;
    }
    setError(null);
    setExpenseOpen(true);
  }

  async function submitExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!myOpenCash?.id) {
      setError('Nenhum caixa aberto para lançar a despesa.');
      return;
    }
    setExpenseBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/v1/cash/sessions/${myOpenCash.id}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'OUT',
          isExpense: true,
          amount: Number(fd.get('amount')),
          chartAccountId: fd.get('chartAccountId'),
          reason: String(fd.get('reason') || '').trim() || undefined,
          paymentMethod: 'CASH',
        }),
      });
      (e.target as HTMLFormElement).reset();
      setExpenseOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao lançar despesa');
    } finally {
      setExpenseBusy(false);
    }
  }

  return (
    <AdminShell title="Venda">
      <PageIntro
        title="Venda"
        description="Resumo das vendas confirmadas no caixa e acesso rápido ao PDV."
        showModuleTabs={false}
      />
      <ErrorBox message={error} />

      <section className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Caixa</h2>
            <p className="mt-0.5 text-sm capitalize text-slate-500">{todayLabel}</p>
          </div>
          {myOpenCash ? (
            <Link
              href={cashSessionListHref(myOpenCash.id)}
              className="text-sm font-medium text-emerald-800 hover:underline"
            >
              Ver movimentações completas
            </Link>
          ) : null}
        </div>

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="grid gap-3 sm:grid-cols-2 xl:col-span-5">
            <KpiMetricCard
              label="Saldo em caixa"
              value={formatBrl(cashSummary?.expectedBalance ?? 0)}
              tone="emerald"
            />
            <KpiMetricCard
              label="Vendas de hoje"
              value={formatBrl(salesStats?.day.totalAmount ?? 0)}
              tone="sky"
              hint={`${salesStats?.day.count ?? 0} venda(s) confirmada(s)`}
            />
            <KpiMetricCard label="Entradas" value={formatBrl(cashSummary?.inflow ?? 0)} tone="emerald" />
            <KpiMetricCard label="Saídas" value={formatBrl(cashSummary?.outflow ?? 0)} tone="rose" />
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">Últimas movimentações</h3>
            </div>
            {recentMoves.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">
                {myOpenRowToday ? 'Nenhuma movimentação neste caixa.' : 'Abra o caixa para ver as movimentações.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                    <tr>
                      <th className="px-4 py-2.5">Data/Hora</th>
                      <th className="px-4 py-2.5">Tipo</th>
                      <th className="px-4 py-2.5">Descrição</th>
                      <th className="px-4 py-2.5">Cliente/Fornecedor</th>
                      <th className="px-4 py-2.5 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentMoves.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                        <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-600">
                          {formatMoveDateTime(m.at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <MoveKindBadge kind={m.kind} inflow={m.inflow} />
                        </td>
                        <td className="px-4 py-2.5 text-slate-900">{m.description}</td>
                        <td className="px-4 py-2.5 text-slate-600">{m.counterparty}</td>
                        <td
                          className={`px-4 py-2.5 text-right font-semibold tabular-nums ${
                            m.inflow ? 'text-emerald-800' : 'text-red-700'
                          }`}
                        >
                          {m.inflow ? '' : '−'}
                          {formatBrl(m.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {salesStats ? (
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <PeriodDashboard title="Este mês" stats={salesStats.month} />
            </div>
          ) : null}

          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" className="h-12 flex-1 text-base font-semibold" onClick={openSaleForm}>
                Realizar venda
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-12 flex-1 text-base font-semibold"
                onClick={openExpenseForm}
              >
                Despesa
              </Button>
            </div>
            {!myOpenRowToday ? (
              <p className="mt-3 text-center text-sm text-amber-800">
                Caixa fechado —{' '}
                <button
                  type="button"
                  className="font-semibold text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
                  onClick={openOpenCashModal}
                >
                  Abrir caixa
                </button>
              </p>
            ) : (
              <p className="mt-3 text-center text-sm text-emerald-800">
                Caixa {formatRecordControl(myOpenCash!.controlNumber)} aberto
              </p>
            )}
          </div>
        </div>
      </section>

      <FormCadastroModal
        open={openCashModalOpen}
        onClose={() => setOpenCashModalOpen(false)}
        title="Abrir caixa"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setOpenCashModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="open-cash-form" disabled={myStaleOpens.length > 0}>
              Abrir sessão
            </Button>
          </>
        }
      >
        {myStaleOpens.length > 0 ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            Você já tem caixa aberto (controle {formatRecordControl(myStaleOpens[0].controlNumber)}, desde{' '}
            {new Date(myStaleOpens[0].openedAt).toLocaleString('pt-BR')}).{' '}
            <button
              type="button"
              className="font-semibold text-emerald-900 underline"
              onClick={() => {
                setOpenCashModalOpen(false);
                router.push(cashSessionListHref(myStaleOpens[0].id));
              }}
            >
              Retomar sessão
            </button>{' '}
            — não abra outra sessão.
          </p>
        ) : (
          <p className="mb-4 text-sm text-slate-600">
            Informe o saldo inicial em dinheiro no caixa físico para iniciar a sessão do dia.
          </p>
        )}
        <form id="open-cash-form" onSubmit={openCashSession}>
          <Field label="Saldo inicial (R$)">
            <input
              name="openingBalance"
              type="number"
              step="0.01"
              min={0}
              className={inputClass}
              required
              disabled={myStaleOpens.length > 0}
              defaultValue={0}
            />
          </Field>
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Despesa"
        hint={
          myOpenCash
            ? `Lançamento no caixa ${formatRecordControl(myOpenCash.controlNumber)} (sessão aberta).`
            : undefined
        }
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setExpenseOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="vendas-cash-expense-form" disabled={expenseBusy}>
              Lançar despesa
            </Button>
          </>
        }
      >
        <form id="vendas-cash-expense-form" onSubmit={submitExpense} className="grid gap-3">
          <Field label="Valor (R$)">
            <input name="amount" type="number" step="0.01" min={0.01} className={inputClass} required />
          </Field>
          <Field label="Centro de custo">
            <ChartAccountSelect flow="payable" required />
          </Field>
          <Field label="Observação">
            <input
              name="reason"
              className={inputClass}
              placeholder="Ex.: combustível, material de limpeza…"
            />
          </Field>
        </form>
      </FormCadastroModal>

      <MiniPdvModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          myOpenCash
            ? `Realizar vendas — caixa ${formatRecordControl(myOpenCash.controlNumber)}`
            : 'Realizar vendas'
        }
        onCompleted={load}
      />
    </AdminShell>
  );
}
