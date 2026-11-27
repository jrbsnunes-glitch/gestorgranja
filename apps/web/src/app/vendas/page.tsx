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
import { BrlMoneyInput } from '@/components/brl-money-input';
import { ClickableKpi } from '@/components/dashboard/kpi-card';
import { formatBrl } from '@/lib/money';
import { useRouter } from 'next/navigation';
import { cashSessionListHref } from '@/lib/cash-session-nav';
import { BUSINESS_TZ, businessTodayDayKey, formatCalendarDatePtBR } from '@/lib/calendar-date';
import { formatRecordControl } from '@/lib/record-control';
import { ExpenseCashLegend, expenseCashCaption } from '@/components/cash/expense-cash-legend';
import { summarizeCashSession } from '@/lib/cash-session-summary';

type CashMovementRow = {
  id: string;
  type: string;
  isExpense?: boolean;
  amount: string;
  reason?: string | null;
  createdAt: string;
  chartAccountId?: string | null;
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

type ConfirmedSale = {
  id: string;
  controlNumber: number;
  status: string;
  totalAmount: string | number;
  partner: { name: string };
  fiscalDoc: { type: string; status: string; errorMessage: string | null } | null;
};

function sessionDayKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date(iso));
}

type OpenSessionListItem = {
  id: string;
  controlNumber: number;
  openedAt: string;
  openingBalance: string;
  status: string;
  isMine: boolean;
  user: { name: string; username: string };
};

type SalesPaymentFormStat = {
  id: string;
  name: string;
  kind: string;
  amount: number;
};

type SalesPeriodStats = {
  count: number;
  totalAmount: number;
  forms?: SalesPaymentFormStat[];
};

type DeskFinance = {
  payables: { dueToday?: number; dueNext7?: number; overdue: number };
  receivables: { dueToday?: number; overdue: number };
};

function dueWithinDays(throughWindow: number, overdue: number) {
  return Math.max(0, Math.round((throughWindow - overdue) * 100) / 100);
}

function isLaterPaymentKind(kind: string) {
  const normalized = kind.toUpperCase();
  return normalized === 'BOLETO' || normalized === 'REQUISICAO';
}

function PaymentBreakdown({ stats, light }: { stats: SalesPeriodStats; light?: boolean }) {
  const laterNote = 'Recebimento posterior';
  const rows = (stats.forms ?? []).map((form) => ({
    id: form.id,
    label: form.name,
    value: form.amount ?? 0,
    later: isLaterPaymentKind(form.kind),
  }));
  const sumOf = (later: boolean) =>
    Math.round(rows.filter((row) => row.later === later).reduce((sum, row) => sum + row.value, 0) * 100) / 100;
  const onSpot = sumOf(false);
  const later = sumOf(true);
  const onSpotNames = rows.filter((row) => !row.later).map((row) => row.label).join(', ');
  const laterNames = rows.filter((row) => row.later).map((row) => row.label).join(', ');
  const label = light ? 'text-emerald-100' : 'text-sky-800';
  const amount = light ? 'text-white' : 'text-sky-950';
  const chip = light ? 'bg-emerald-900/40' : 'bg-white/80';
  const note = light ? 'text-emerald-200' : 'text-amber-800';
  const subChip = light ? 'border-emerald-600/50 bg-emerald-900/30' : 'border-sky-200 bg-white';
  if (rows.length === 0) {
    return (
      <p className={`mt-3 text-sm ${label}`}>
        Nenhuma forma Pix, Requisição ou Boleto ativa em Formas de pagamento.
      </p>
    );
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <div key={row.id} className={`rounded-lg px-3 py-2 ${chip}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${label}`}>{row.label}</p>
            <p className={`text-base font-bold tabular-nums ${amount}`}>{formatBrl(row.value)}</p>
            {row.later ? <p className={`mt-0.5 text-[11px] leading-tight ${note}`}>{laterNote}</p> : null}
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className={`rounded-lg border px-3 py-2 ${subChip}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${label}`}>No ato</p>
          <p className={`text-lg font-bold tabular-nums ${amount}`}>{formatBrl(onSpot)}</p>
          {onSpotNames ? <p className={`text-[11px] ${label}`}>{onSpotNames}</p> : null}
        </div>
        <div className={`rounded-lg border px-3 py-2 ${subChip}`}>
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${label}`}>Recebido depois</p>
          <p className={`text-lg font-bold tabular-nums ${amount}`}>{formatBrl(later)}</p>
          {laterNames ? <p className={`text-[11px] ${label}`}>{laterNames}</p> : null}
        </div>
      </div>
    </div>
  );
}

function fiscalStatusLabel(status: string) {
  switch (status) {
    case 'AUTHORIZED':
      return 'Autorizada';
    case 'REJECTED':
      return 'Rejeitada';
    case 'PROCESSING':
      return 'Processando';
    case 'CANCELLED':
      return 'Cancelada';
    case 'DRAFT':
      return 'Rascunho';
    default:
      return status;
  }
}

export default function VendasPage() {
  const router = useRouter();
  const [myOpenCash, setMyOpenCash] = useState<MyOpenCash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickChoice, setPickChoice] = useState('');
  const [saleSessionId, setSaleSessionId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [editingExpense, setEditingExpense] = useState<CashMovementRow | null>(null);
  const [deskFinance, setDeskFinance] = useState<DeskFinance | null>(null);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [salesStats, setSalesStats] = useState<{ day: SalesPeriodStats; month: SalesPeriodStats } | null>(null);
  const [confirmedSales, setConfirmedSales] = useState<ConfirmedSale[]>([]);
  const [emitBusy, setEmitBusy] = useState<string | null>(null);

  const myOpenRowToday = myOpenCash != null && myOpenCash.status === 'OPEN';
  const cashSummary = myOpenCash
    ? summarizeCashSession(myOpenCash.openingBalance, myOpenCash.movements ?? [])
    : null;
  const openExpenses = (myOpenCash?.movements ?? []).filter((m) => m.isExpense);
  const expenseCash = myOpenCash
    ? {
        controlNumber: myOpenCash.controlNumber,
        openedAt: myOpenCash.openedAt,
        status: myOpenCash.status,
        operator: openSessions.find((s) => s.id === myOpenCash.id)?.user.name ?? null,
      }
    : null;
  const payDueToday = deskFinance?.payables.dueToday ?? 0;
  const payAhead7 = deskFinance
    ? dueWithinDays(deskFinance.payables.dueNext7 ?? 0, deskFinance.payables.overdue)
    : 0;
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
  const todayKey = businessTodayDayKey();
  const priorOpens = useMemo(
    () => openSessions.filter((s) => sessionDayKey(s.openedAt) < todayKey),
    [openSessions, todayKey],
  );
  const saleSession =
    openSessions.find((s) => s.id === saleSessionId) ??
    (myOpenCash ? openSessions.find((s) => s.id === myOpenCash.id) : undefined) ??
    null;

  const load = useCallback(() => {
    void apiFetch<MyOpenCash | null>('/v1/cash/sessions/open/me').then(setMyOpenCash);
    void apiFetch<OpenSessionListItem[]>('/v1/cash/sessions/open/list').then(setOpenSessions);
    void apiFetch<{ day: SalesPeriodStats; month: SalesPeriodStats }>('/v1/commercial/stats')
      .then(setSalesStats)
      .catch(() => setSalesStats(null));
    void apiFetch<{ finance?: DeskFinance }>('/v1/home/dashboard')
      .then((home) => setDeskFinance(home.finance ?? null))
      .catch(() => setDeskFinance(null));
    void apiFetch<ConfirmedSale[]>('/v1/commercial/orders')
      .then((rows) => setConfirmedSales(rows.filter((o) => o.status === 'CONFIRMED').slice(0, 12)))
      .catch(() => setConfirmedSales([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function emitFiscal(orderId: string, type: 'NFCE' | 'NFE') {
    setError(null);
    setEmitBusy(`${orderId}:${type}`);
    try {
      await apiFetch(`/v1/fiscal/emit/${orderId}?type=${type}`, { method: 'POST', body: '{}' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao emitir a nota');
    } finally {
      setEmitBusy(null);
    }
  }

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
    if (!myOpenRowToday && priorOpens.length === 0) {
      setError('Abra o caixa antes de registrar vendas.');
      openOpenCashModal();
      return;
    }
    setError(null);
    const mineToday =
      myOpenCash && sessionDayKey(myOpenCash.openedAt) === todayKey ? myOpenCash.id : '';
    if (priorOpens.length > 0) {
      const minePrior = priorOpens.find((s) => s.isMine)?.id;
      setPickChoice(mineToday || minePrior || priorOpens[0].id);
      setPickOpen(true);
      return;
    }
    setSaleSessionId(myOpenCash?.id ?? null);
    setFormOpen(true);
  }

  function confirmCashChoice() {
    if (!pickChoice) return;
    setSaleSessionId(pickChoice);
    setPickOpen(false);
    setFormOpen(true);
  }

  function openExpenseForm() {
    if (!myOpenRowToday || !myOpenCash) {
      setError('Abra o caixa antes de lançar despesas.');
      openOpenCashModal();
      return;
    }
    setError(null);
    setEditingExpense(null);
    setExpenseOpen(true);
  }

  function openEditExpense(row: CashMovementRow) {
    if (!myOpenRowToday) {
      setError('A despesa só pode ser editada ou excluída enquanto o caixa estiver aberto.');
      return;
    }
    setError(null);
    setEditingExpense(row);
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
      const body = {
        type: 'OUT' as const,
        isExpense: true,
        amount: Number(fd.get('amount')),
        chartAccountId: fd.get('chartAccountId'),
        reason: String(fd.get('reason') || '').trim() || undefined,
        paymentMethod: 'CASH',
      };
      if (editingExpense) {
        await apiFetch(`/v1/cash/sessions/${myOpenCash.id}/movements/${editingExpense.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch(`/v1/cash/sessions/${myOpenCash.id}/movements`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }
      setEditingExpense(null);
      setExpenseOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao lançar despesa');
    } finally {
      setExpenseBusy(false);
    }
  }

  async function deleteExpense(row: CashMovementRow) {
    if (!myOpenCash || !myOpenRowToday) {
      setError('A despesa só pode ser editada ou excluída enquanto o caixa estiver aberto.');
      return;
    }
    if (!confirm('Excluir esta despesa do caixa aberto?')) return;
    setError(null);
    try {
      await apiFetch(`/v1/cash/sessions/${myOpenCash.id}/movements/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir despesa');
    }
  }

  return (
    <AdminShell title="Venda">
      <PageIntro
        title="Venda"
        description="Comece por aqui: vendas do mês e do dia, o que entrou e saiu do caixa, e as contas que pedem ação."
        showModuleTabs={false}
      />
      <ErrorBox message={error} />

      <section className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" className="h-12 px-6 text-base font-semibold shadow-sm" onClick={openSaleForm}>
            Realizar venda
          </Button>
          <Link
            href="/financeiro/pagar"
            className="inline-flex h-11 items-center justify-center rounded-md bg-rose-50 px-4 text-sm font-semibold text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100"
          >
            Contas a pagar
          </Link>
          <Link
            href="/financeiro/receber"
            className="inline-flex h-11 items-center justify-center rounded-md bg-emerald-50 px-4 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            Contas a receber
          </Link>
          <Button type="button" variant="secondary" className="h-11 px-4" onClick={openExpenseForm}>
            Despesa
          </Button>
        </div>
        {!myOpenRowToday ? (
          <p className="-mt-2 text-sm text-amber-800">
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
          <p className="-mt-2 text-sm text-emerald-800">
            Caixa {formatRecordControl(myOpenCash!.controlNumber)} aberto
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">O que fazer agora</h2>
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

        {salesStats ? (
          <article className="rounded-2xl bg-emerald-800 px-5 py-5 text-white shadow-sm sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">Vendas do mês</p>
            <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight sm:text-5xl">
              {formatBrl(salesStats.month.totalAmount)}
            </p>
            <p className="mt-1 text-sm text-emerald-100">
              {salesStats.month.count} venda(s) confirmada(s) neste mês
            </p>
            <PaymentBreakdown stats={salesStats.month} light />
          </article>
        ) : null}

        <article className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">Vendas de hoje</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-sky-950">
            {formatBrl(salesStats?.day.totalAmount ?? 0)}
          </p>
          <p className="mt-1 max-w-3xl text-sm text-sky-900">
            {salesStats?.day.count ?? 0} pedido(s) confirmado(s) hoje. O detalhe abaixo segue as formas ativas do
            cadastro, na ordem Pix, Requisição e Boleto. Requisição e boleto ficam para receber depois.
          </p>
          {salesStats ? <PaymentBreakdown stats={salesStats.day} /> : null}
        </article>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Movimento deste caixa</h3>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Entradas são o dinheiro que entrou nesta sessão. Vendas do dia são os pedidos confirmados, com ou sem
            recebimento imediato. O saldo é o que fica depois das saídas.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">1 · Entradas</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-emerald-950">
                {formatBrl(cashSummary?.inflow ?? 0)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                Dinheiro que entrou neste caixa: vendas à vista e outros recebimentos lançados. Boleto e crédito a
                receber depois não entram aqui.
              </p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">2 · Saídas</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-rose-900">
                {formatBrl(cashSummary?.outflow ?? 0)}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {cashSummary && cashSummary.expenses > 0
                  ? `Despesas e retiradas deste caixa, das quais ${formatBrl(cashSummary.expenses)} são despesas.`
                  : 'Despesas e retiradas lançadas neste caixa.'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-300 bg-slate-900 px-4 py-4 text-white">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">3 · Saldo em caixa</p>
              <p className="mt-1 text-3xl font-bold tabular-nums">
                {formatBrl(cashSummary?.expectedBalance ?? 0)}
              </p>
              <p className="mt-2 text-sm text-slate-300">
                O que fica: saldo inicial {formatBrl(cashSummary?.opening ?? 0)} + entradas − saídas.
              </p>
            </div>
          </div>
        </div>

        {deskFinance ? (
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Contas para olhar hoje</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <ClickableKpi
                href="/financeiro/pagar?dueDays=7"
                label="A pagar em 7 dias"
                value={formatBrl(payAhead7)}
                tone={payAhead7 > 0 ? 'warn' : 'default'}
              />
              <ClickableKpi
                href="/financeiro/pagar?dueDays=0"
                label="A pagar hoje"
                value={formatBrl(payDueToday)}
                tone={payDueToday > 0 ? 'warn' : 'default'}
              />
              <ClickableKpi
                href="/financeiro/pagar?overdue=1"
                label="Contas a pagar atrasadas"
                value={formatBrl(deskFinance.payables.overdue)}
                tone={deskFinance.payables.overdue > 0 ? 'bad' : 'default'}
              />
              <ClickableKpi
                href="/financeiro/receber?dueDays=0"
                label="A receber hoje"
                value={formatBrl(deskFinance.receivables.dueToday ?? 0)}
                tone={(deskFinance.receivables.dueToday ?? 0) > 0 ? 'good' : 'default'}
              />
              <ClickableKpi
                href="/financeiro/receber?overdue=1"
                label="Contas a receber atrasadas"
                value={formatBrl(deskFinance.receivables.overdue)}
                tone={deskFinance.receivables.overdue > 0 ? 'bad' : 'default'}
              />
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-12">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-7">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">Vendas confirmadas — emitir</h3>
            </div>
            {confirmedSales.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhuma venda confirmada.</p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
                {confirmedSales.map((sale) => {
                  const fiscal = sale.fiscalDoc;
                  const fiscalHint = fiscal
                    ? `${fiscal.type === 'NFCE' ? 'NFC-e' : fiscal.type === 'NFE' ? 'NF-e' : fiscal.type} · ${fiscalStatusLabel(fiscal.status)}`
                    : 'Sem nota';
                  return (
                    <li key={sale.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {formatRecordControl(sale.controlNumber)} · {sale.partner.name}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatBrl(Number(sale.totalAmount))} · {fiscalHint}
                          {fiscal?.errorMessage ? ` — ${fiscal.errorMessage}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          type="button"
                          className="h-8 px-2.5 text-xs"
                          disabled={emitBusy != null}
                          onClick={() => void emitFiscal(sale.id, 'NFCE')}
                        >
                          {emitBusy === `${sale.id}:NFCE` ? '…' : 'NFC-e'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="h-8 px-2.5 text-xs"
                          disabled={emitBusy != null}
                          onClick={() => void emitFiscal(sale.id, 'NFE')}
                        >
                          {emitBusy === `${sale.id}:NFE` ? '…' : 'NF-e'}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-5">
            <div className="border-b border-slate-100 px-4 py-3">
              <h3 className="text-base font-semibold text-slate-900">Despesas deste caixa</h3>
              <p className="mt-1 text-xs text-amber-800">
                A despesa só pode ser editada ou excluída enquanto o caixa estiver aberto.
              </p>
            </div>
            {openExpenses.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Nenhuma despesa neste caixa.</p>
            ) : (
              <ul className="max-h-[22rem] divide-y divide-slate-100 overflow-y-auto">
                {openExpenses.map((row) => (
                  <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {formatBrl(Number(row.amount))}
                        {row.reason ? ` · ${row.reason}` : ''}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {row.chartAccount ? `${row.chartAccount.code} — ${row.chartAccount.name}` : 'Sem centro de custo'}
                      </p>
                      <p className={`truncate text-xs ${expenseCash ? 'text-slate-500' : 'font-medium text-amber-800'}`}>
                        {expenseCashCaption(expenseCash)}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => openEditExpense(row)}>
                        Editar
                      </Button>
                      <Button type="button" variant="secondary" className="h-8 px-2.5 text-xs" onClick={() => void deleteExpense(row)}>
                        Excluir
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
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
            <BrlMoneyInput
              name="openingBalance"
              className={inputClass}
              required
              disabled={myStaleOpens.length > 0}
              defaultValue={0}
              min={0}
            />
          </Field>
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title={editingExpense ? 'Editar despesa' : 'Despesa'}
        hint="A despesa só pode ser editada ou excluída enquanto o caixa estiver aberto."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setExpenseOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="vendas-cash-expense-form" disabled={expenseBusy}>
              {editingExpense ? 'Salvar despesa' : 'Lançar despesa'}
            </Button>
          </>
        }
      >
        <form id="vendas-cash-expense-form" onSubmit={submitExpense} className="grid gap-3" key={editingExpense?.id ?? 'new'}>
          {editingExpense ? <ExpenseCashLegend cash={expenseCash} /> : null}
          <Field label="Valor (R$)">
            <BrlMoneyInput
              name="amount"
              className={inputClass}
              required
              min={0.01}
              defaultValue={editingExpense ? Number(editingExpense.amount) : undefined}
            />
          </Field>
          <Field label="Centro de custo">
            <ChartAccountSelect flow="payable" required defaultValue={editingExpense?.chartAccountId ?? ''} />
          </Field>
          <Field label="Observação">
            <input
              name="reason"
              className={inputClass}
              placeholder="Ex.: combustível, material de limpeza…"
              defaultValue={editingExpense?.reason ?? ''}
            />
          </Field>
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        title="Escolher o caixa"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPickOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={confirmCashChoice} disabled={!pickChoice}>
              Continuar
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-slate-600">
          Há caixa aberto de dia anterior. A venda entra no caixa escolhido, com a data de abertura dele.
          Se o caixa de hoje estiver aberto, ele continua como opção padrão.
        </p>
        <div className="grid gap-2">
          {myOpenCash && sessionDayKey(myOpenCash.openedAt) === todayKey ? (
            <label className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="cash-choice"
                className="mt-1"
                checked={pickChoice === myOpenCash.id}
                onChange={() => setPickChoice(myOpenCash.id)}
              />
              <span>
                <span className="font-medium">Caixa de hoje {formatRecordControl(myOpenCash.controlNumber)}</span>
                <span className="block text-slate-500">
                  {formatCalendarDatePtBR(sessionDayKey(myOpenCash.openedAt))}
                </span>
              </span>
            </label>
          ) : null}
          {priorOpens.map((s) => (
            <label key={s.id} className="flex items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input
                type="radio"
                name="cash-choice"
                className="mt-1"
                checked={pickChoice === s.id}
                onChange={() => setPickChoice(s.id)}
              />
              <span>
                <span className="font-medium">
                  Caixa {formatRecordControl(s.controlNumber)}
                  {s.isMine ? '' : ` · ${s.user.name}`}
                </span>
                <span className="block text-slate-500">
                  Aberto em {new Date(s.openedAt).toLocaleString('pt-BR', { timeZone: BUSINESS_TZ })}
                </span>
              </span>
            </label>
          ))}
        </div>
      </FormCadastroModal>

      <MiniPdvModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          saleSession
            ? `Realizar vendas — caixa ${formatRecordControl(saleSession.controlNumber)}`
            : myOpenCash
              ? `Realizar vendas — caixa ${formatRecordControl(myOpenCash.controlNumber)}`
              : 'Realizar vendas'
        }
        cashSessionId={saleSessionId ?? myOpenCash?.id ?? null}
        cashSaleDate={
          saleSession
            ? sessionDayKey(saleSession.openedAt)
            : myOpenCash
              ? sessionDayKey(myOpenCash.openedAt)
              : null
        }
        onCompleted={load}
      />
    </AdminShell>
  );
}
