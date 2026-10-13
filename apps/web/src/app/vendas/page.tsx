'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro } from '@/components/crud';
import { MiniPdvModal } from '@/components/vendas/mini-pdv-modal';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatBrl } from '@/lib/money';
import { useRouter } from 'next/navigation';
import { cashSessionListHref } from '@/lib/cash-session-nav';
import { formatRecordControl } from '@/lib/record-control';

type MyOpenCash = {
  id: string;
  controlNumber: number;
  openingBalance: string;
  openedAt: string;
  status: string;
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
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [salesStats, setSalesStats] = useState<{ day: SalesPeriodStats; month: SalesPeriodStats } | null>(null);

  const myOpenRowToday = myOpenCash != null && myOpenCash.status === 'OPEN';

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

  return (
    <AdminShell title="Venda">
      <PageIntro
        title="Venda"
        description="Resumo das vendas confirmadas no caixa e acesso rápido ao PDV."
        showModuleTabs={false}
      />
      <ErrorBox message={error} />

      <section className="mx-auto max-w-4xl space-y-8">
        {salesStats ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <PeriodDashboard title="Hoje" stats={salesStats.day} tone="good" />
            <PeriodDashboard title="Este mês" stats={salesStats.month} />
          </div>
        ) : (
          <p className="text-center text-sm text-slate-600">Carregando resumo de vendas…</p>
        )}

        <div className="flex flex-col items-center gap-3 rounded-2xl border border-emerald-200/80 bg-gradient-to-b from-emerald-50/90 to-white px-6 py-10 shadow-sm">
          <Button
            type="button"
            className="min-h-[4rem] w-full max-w-md px-12 text-xl font-bold shadow-lg shadow-emerald-900/25 ring-2 ring-emerald-600/35 ring-offset-2 ring-offset-white"
            onClick={openSaleForm}
          >
            Realizar vendas
          </Button>
          {!myOpenRowToday ? (
            <p className="text-center text-sm text-amber-800">
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
            <p className="text-center text-sm text-emerald-800">
              Caixa {formatRecordControl(myOpenCash!.controlNumber)} aberto
            </p>
          )}
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

      <MiniPdvModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={
          myOpenCash
            ? `Realizar vendas — caixa ${formatRecordControl(myOpenCash.controlNumber)}`
            : 'Realizar vendas'
        }
        cashSessionId={myOpenCash?.id ?? ''}
        onCompleted={load}
        onExpenseRecorded={load}
      />
    </AdminShell>
  );
}
