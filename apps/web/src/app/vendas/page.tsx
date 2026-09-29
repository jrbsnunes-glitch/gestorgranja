'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro } from '@/components/crud';
import { MiniPdvModal } from '@/components/vendas/mini-pdv-modal';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { Kpi } from '@/components/dashboard/kpi-card';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatBrl } from '@/lib/money';
import { formatRecordControl } from '@/lib/record-control';

type CashSessionRow = {
  id: string;
  controlNumber: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string;
  user: { name: string; username: string };
};

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

function todayLocalKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function isOpenedToday(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = todayLocalKey();
  const localDay = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const utcDay = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  return localDay === today || utcDay === today;
}

function buildDayCashSessions(cashSessions: CashSessionRow[], myOpenCash: MyOpenCash | null): CashSessionRow[] {
  const byId = new Map<string, CashSessionRow>();
  for (const s of cashSessions) {
    if (isOpenedToday(s.openedAt)) byId.set(s.id, s);
  }
  for (const s of cashSessions) {
    if (s.status === 'OPEN') byId.set(s.id, s);
  }
  if (myOpenCash && !byId.has(myOpenCash.id)) {
    const fromList = cashSessions.find((s) => s.id === myOpenCash.id);
    byId.set(
      myOpenCash.id,
      fromList ?? {
        id: myOpenCash.id,
        controlNumber: myOpenCash.controlNumber,
        status: myOpenCash.status,
        openedAt: myOpenCash.openedAt,
        closedAt: null,
        openingBalance: myOpenCash.openingBalance,
        user: { name: 'Você', username: '—' },
      },
    );
  }
  return [...byId.values()].sort(
    (a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime(),
  );
}

export default function VendasPage() {
  const [cashSessions, setCashSessions] = useState<CashSessionRow[]>([]);
  const [myOpenCash, setMyOpenCash] = useState<MyOpenCash | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [openCashModalOpen, setOpenCashModalOpen] = useState(false);
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [salesStats, setSalesStats] = useState<{
    day: { count: number; totalAmount: number };
    month: { count: number; totalAmount: number };
  } | null>(null);

  const dayCashSessions = useMemo(
    () => buildDayCashSessions(cashSessions, myOpenCash),
    [cashSessions, myOpenCash],
  );

  const myOpenRowToday = myOpenCash != null && myOpenCash.status === 'OPEN';

  const myStaleOpens = useMemo(
    () => openSessions.filter((s) => s.isMine),
    [openSessions],
  );

  const load = useCallback(() => {
    void apiFetch<CashSessionRow[]>('/v1/cash/sessions').then(setCashSessions);
    void apiFetch<MyOpenCash | null>('/v1/cash/sessions/open/me').then(setMyOpenCash);
    void apiFetch<OpenSessionListItem[]>('/v1/cash/sessions/open/list').then(setOpenSessions);
    void apiFetch<{ day: { count: number; totalAmount: number }; month: { count: number; totalAmount: number } }>(
      '/v1/commercial/stats',
    )
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
    <AdminShell title="Vendas">
      <PageIntro
        title="Vendas"
        description="Confirme vendas no seu caixa aberto; os valores entram automaticamente como entrada no caixa."
      />
      <ErrorBox message={error} />

      <section className="mb-6 overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50 via-white to-slate-50 shadow-sm">
        <div className="grid gap-6 p-5 md:p-8 lg:grid-cols-[1fr_min(18rem,100%)] lg:items-start lg:gap-8">
          <div className="min-w-0 space-y-4">
            {salesStats ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <Kpi
                  tone="good"
                  label="Vendas hoje"
                  value={formatBrl(salesStats.day.totalAmount)}
                  sub={`${salesStats.day.count} confirmada(s)`}
                />
                <Kpi
                  label="Vendas no mês"
                  value={formatBrl(salesStats.month.totalAmount)}
                  sub={`${salesStats.month.count} confirmada(s)`}
                />
              </div>
            ) : (
              <p className="text-sm text-slate-600">Carregando resumo de vendas…</p>
            )}
            <Link
              href="/vendas/caixa"
              className="inline-flex text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
            >
              Ver todos os caixas (abertos, conferência e histórico)
            </Link>
          </div>
          <div className="flex w-full flex-col gap-2 lg:justify-self-end">
            <Button
              type="button"
              className="min-h-[3.75rem] w-full px-10 text-lg font-bold shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-600/30 ring-offset-2 ring-offset-emerald-50/80"
              onClick={openSaleForm}
            >
              Realizar vendas
            </Button>
            {!myOpenRowToday ? (
              <p className="text-center text-xs text-amber-800">
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
              <p className="text-center text-xs text-emerald-800">
                Caixa {formatRecordControl(myOpenCash!.controlNumber)} aberto
              </p>
            )}
          </div>
        </div>
      </section>

      <PageCard title="Caixa do dia">
        <p className="mb-4 text-sm text-slate-600">
          {new Date().toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
          {!myOpenRowToday ? (
            <>
              {' '}
              · Para vender,{' '}
              <button
                type="button"
                className="font-medium text-emerald-800 underline underline-offset-2 hover:text-emerald-950"
                onClick={openOpenCashModal}
              >
                abra o caixa
              </button>
              .
            </>
          ) : null}
        </p>

        <ResponsiveTableWrap>
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
                <th className="px-3 py-2">Controle</th>
                <th className="px-3 py-2">Operador</th>
                <th className="px-3 py-2">Abertura</th>
                <th className="px-3 py-2">Saldo inicial</th>
                <th className="px-3 py-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {dayCashSessions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma sessão de caixa registrada hoje.
                  </td>
                </tr>
              ) : (
                dayCashSessions.map((s) => {
                  const isOpen = s.status === 'OPEN';
                  return (
                    <tr key={s.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 tabular-nums">{formatRecordControl(s.controlNumber)}</td>
                      <td className="px-3 py-2.5">
                        {s.user.name}
                        <span className="text-slate-500"> ({s.user.username})</span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {new Date(s.openedAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums">{formatBrl(Number(s.openingBalance))}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            isOpen ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {isOpen ? 'Aberto' : 'Fechado'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      </PageCard>

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
            <Link
              href={`/vendas/caixa/sessao/${myStaleOpens[0].id}`}
              className="font-semibold text-emerald-900 underline"
              onClick={() => setOpenCashModalOpen(false)}
            >
              Retomar sessão
            </Link>{' '}
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
