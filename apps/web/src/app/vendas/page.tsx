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
import { BUSINESS_TZ, businessTodayDayKey, formatCalendarDatePtBR } from '@/lib/calendar-date';
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

type SalesPeriodStats = {
  count: number;
  totalAmount: number;
  noAto: number;
  requisicao: number;
  boleto: number;
  cartao: number;
};

function PaymentBreakdown({ stats }: { stats: SalesPeriodStats }) {
  const rows = [
    { label: 'No ato', value: stats.noAto, tone: 'text-emerald-800' },
    { label: 'Requisição', value: stats.requisicao, tone: 'text-slate-800' },
    { label: 'Boletos', value: stats.boleto, tone: 'text-amber-900' },
    { label: 'Cartão de crédito (Recebimento posterior)', value: stats.cartao ?? 0, tone: 'text-violet-800' },
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
  const [pickOpen, setPickOpen] = useState(false);
  const [pickChoice, setPickChoice] = useState('');
  const [saleSessionId, setSaleSessionId] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [salesStats, setSalesStats] = useState<{ day: SalesPeriodStats; month: SalesPeriodStats } | null>(null);
  const [confirmedSales, setConfirmedSales] = useState<ConfirmedSale[]>([]);
  const [emitBusy, setEmitBusy] = useState<string | null>(null);

  const myOpenRowToday = myOpenCash != null && myOpenCash.status === 'OPEN';
  const cashSummary = myOpenCash
    ? summarizeCashSession(myOpenCash.openingBalance, myOpenCash.movements ?? [])
    : null;
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
        </div>

        {salesStats ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
            <PeriodDashboard title="Este mês" stats={salesStats.month} />
          </div>
        ) : null}
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
