'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { CashReportLauncher } from '@/components/cash-report-launcher';
import { FormCadastroModal, ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, TabBar, usePagination } from '@/components/list-crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { openCashReportPrint } from '@/lib/cash-report-query';
import {
  cashMovementKindLabel,
  summarizeCashSession,
  summarizeCashSessionByPaymentMethod,
} from '@/lib/cash-session-summary';
import { errorMessage, labelEnum } from '@/lib/labels';
import { formatBrl } from '@/lib/money';

function parseApiError(err: unknown) {
  return errorMessage(err);
}

type Movement = {
  id: string;
  type: string;
  isExpense: boolean;
  amount: string;
  reason: string | null;
  paymentMethod: string | null;
  createdAt: string;
  chartAccountId?: string | null;
  chartAccount: { code: string; name: string } | null;
};

type OpenSession = {
  id: string;
  controlNumber?: number;
  openingBalance: string;
  openedAt: string;
  status: string;
  movements: Movement[];
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

type SessionRow = {
  id: string;
  controlNumber: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string;
  closingBalance: string | null;
  closingNotes?: string | null;
  user: { name: string; username: string };
  movements?: Movement[];
};

type PendingReconcileSession = {
  id: string;
  controlNumber: number;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string;
  closingBalance: string | null;
  closingBreakdown?: Record<string, number> | null;
  closingNotes: string | null;
  user: { name: string; username: string };
  movements: Movement[];
};

type MovementKind = 'IN' | 'OUT' | 'EXPENSE';

type ManagementLoad = {
  mode: 'operate' | 'reconcile' | 'view';
  session: OpenSession & SessionRow;
};

export function CashSessionWorkspacePage({
  focusSessionId,
  embedded,
}: {
  focusSessionId?: string;
  /** Dentro de Vendas e caixa — sem shell Financeiro e, com focus, só a sessão. */
  embedded?: boolean;
}) {
  const sessionFocus = Boolean(embedded && focusSessionId);
  const [tab, setTab] = useState('atual');
  const [open, setOpen] = useState<OpenSession | null>(null);
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [pending, setPending] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [presentedByMethod, setPresentedByMethod] = useState<Record<string, string>>({});
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [closeTarget, setCloseTarget] = useState<OpenSession | null>(null);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileDetail, setReconcileDetail] = useState<PendingReconcileSession | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileMovementKind, setReconcileMovementKind] = useState<MovementKind>('IN');
  const [reconcileEditing, setReconcileEditing] = useState<Movement | null>(null);
  const [reconcileEditKind, setReconcileEditKind] = useState<MovementKind>('IN');
  const [reconcileReadOnly, setReconcileReadOnly] = useState(false);

  const sessionForClose = closeTarget ?? open;

  const sessionSummary = useMemo(() => {
    if (!sessionForClose) return null;
    return summarizeCashSession(sessionForClose.openingBalance, sessionForClose.movements);
  }, [sessionForClose]);

  const closeByPayment = useMemo(() => {
    if (!sessionForClose) return null;
    return summarizeCashSessionByPaymentMethod(sessionForClose.openingBalance, sessionForClose.movements);
  }, [sessionForClose]);

  const myStaleOpens = useMemo(
    () => openSessions.filter((s) => s.isMine),
    [openSessions],
  );

  const movList = useCrudList({
    items: open?.movements ?? [],
    searchFields: (m) => [
      cashMovementKindLabel(m),
      m.reason ?? '',
      m.paymentMethod ?? '',
      m.chartAccount?.code ?? '',
    ],
  });
  const movPag = usePagination(movList.filtered);
  const histList = useCrudList({
    items: history,
    searchFields: (s) => [s.user.name, s.user.username, s.status],
  });
  const histPag = usePagination(histList.filtered);
  const pendingList = useCrudList({
    items: pending,
    searchFields: (s) => [s.user.name, s.status],
  });
  const pendingPag = usePagination(pendingList.filtered);

  const load = useCallback(() => {
    void apiFetch<OpenSession | null>('/v1/cash/sessions/open/me')
      .then(setOpen)
      .catch(() => setOpen(null));
    void apiFetch<OpenSessionListItem[]>('/v1/cash/sessions/open/list').then(setOpenSessions);
    void apiFetch<SessionRow[]>('/v1/cash/sessions').then(setHistory);
    void apiFetch<SessionRow[]>('/v1/cash/sessions/pending-reconciliation').then(setPending);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!focusSessionId) return;
    void apiFetch<ManagementLoad>(`/v1/cash/sessions/${focusSessionId}/management`)
      .then((res) => {
        if (res.mode === 'operate') {
          setOpen(res.session as OpenSession);
          setTab('atual');
        } else if (res.mode === 'reconcile') {
          setReconcileReadOnly(false);
          setReconcileDetail(res.session as PendingReconcileSession);
          setReconcileNotes(res.session.closingNotes ?? '');
          setReconcileModalOpen(true);
        } else {
          setReconcileReadOnly(true);
          setReconcileDetail(res.session as PendingReconcileSession);
          setReconcileNotes(
            (res.session as SessionRow & { reconciliationNotes?: string | null }).reconciliationNotes ??
              res.session.closingNotes ??
              '',
          );
          setReconcileModalOpen(sessionFocus);
          if (!sessionFocus) {
            setTab('historico');
            const row = res.session as SessionRow;
            setHistory((h) => (h.some((x) => x.id === row.id) ? h : [row, ...h]));
          }
        }
      })
      .catch((err) => setError(parseApiError(err)));
  }, [focusSessionId, sessionFocus]);

  async function openSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/cash/sessions/open', {
        method: 'POST',
        body: JSON.stringify({ openingBalance: Number(fd.get('openingBalance')) }),
      });
      load();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function resumeSession(sessionId: string) {
    setError(null);
    try {
      const session = await apiFetch<OpenSession>(`/v1/cash/sessions/${sessionId}`);
      setOpen(session);
      setCloseTarget(null);
      setTab('atual');
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  function openCloseModal(from?: OpenSession) {
    setError(null);
    const target = from ?? open;
    if (!target) return;
    setCloseTarget(from ?? null);
    const byPay = summarizeCashSessionByPaymentMethod(target.openingBalance, target.movements);
    setPresentedByMethod(
      Object.fromEntries(byPay.methods.map((m) => [m, String(byPay.expected[m] ?? 0)])),
    );
    setCloseModalOpen(true);
  }

  async function closeSessionFromHistory(row: SessionRow) {
    if (row.movements?.length) {
      openCloseModal({
        id: row.id,
        controlNumber: row.controlNumber,
        openingBalance: row.openingBalance,
        openedAt: row.openedAt,
        status: row.status,
        movements: row.movements,
      });
      return;
    }
    try {
      const session = await apiFetch<OpenSession>(`/v1/cash/sessions/${row.id}`);
      openCloseModal(session);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function closeOpenListItem(item: OpenSessionListItem) {
    try {
      const session = await apiFetch<OpenSession>(`/v1/cash/sessions/${item.id}`);
      openCloseModal(session);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function closeSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const target = sessionForClose;
    if (!target) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const methods = closeByPayment?.methods ?? [];
    const closingByMethod: Record<string, number> = {};
    for (const method of methods) {
      const v = Number(presentedByMethod[method] ?? fd.get(`presented_${method}`));
      if (!Number.isFinite(v) || v < 0) {
        setError(`Informe um valor válido para ${labelEnum(method)}.`);
        return;
      }
      closingByMethod[method] = Math.round(v * 100) / 100;
    }
    const closingBalance = Math.round(Object.values(closingByMethod).reduce((s, n) => s + n, 0) * 100) / 100;
    try {
      await apiFetch(`/v1/cash/sessions/${target.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          closingBalance,
          closingByMethod,
          closingNotes: fd.get('closingNotes') || undefined,
        }),
      });
      setCloseModalOpen(false);
      setCloseTarget(null);
      setOpen(null);
      setSuccess('Caixa encerrado — status: aguardando conciliação.');
      setTab('pendentes');
      load();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  const presentedTotal = useMemo(() => {
    if (!closeByPayment) return NaN;
    let sum = 0;
    let any = false;
    for (const m of closeByPayment.methods) {
      const raw = presentedByMethod[m];
      if (raw === '' || raw === undefined) continue;
      const v = Number(raw);
      if (Number.isFinite(v)) {
        sum += v;
        any = true;
      }
    }
    return any ? Math.round(sum * 100) / 100 : NaN;
  }, [closeByPayment, presentedByMethod]);

  const closeDiff =
    closeByPayment && Number.isFinite(presentedTotal)
      ? Math.round((closeByPayment.totalExpected - presentedTotal) * 100) / 100
      : null;

  const reconcileSummary = useMemo(() => {
    if (!reconcileDetail) return null;
    return summarizeCashSession(reconcileDetail.openingBalance, reconcileDetail.movements);
  }, [reconcileDetail]);

  const reconcileDiff =
    reconcileSummary && reconcileDetail?.closingBalance != null
      ? Math.round(
          (reconcileSummary.expectedBalance - Number(reconcileDetail.closingBalance)) * 100,
        ) / 100
      : null;

  async function reloadReconcileDetail(sessionId: string) {
    const detail = await apiFetch<PendingReconcileSession>(
      `/v1/cash/sessions/${sessionId}/reconciliation`,
    );
    setReconcileDetail(detail);
  }

  async function openReconcileModal(row: SessionRow) {
    setError(null);
    setReconcileLoading(true);
    setReconcileModalOpen(true);
    setReconcileNotes('');
    setReconcileEditing(null);
    setReconcileMovementKind('IN');
    try {
      await reloadReconcileDetail(row.id);
    } catch (err) {
      setReconcileModalOpen(false);
      setError(parseApiError(err));
    } finally {
      setReconcileLoading(false);
    }
  }

  async function addReconcileMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reconcileDetail) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const kind = (fd.get('movementKind') as MovementKind) || reconcileMovementKind;
    const isExpense = kind === 'EXPENSE';
    const type = kind === 'IN' ? 'IN' : 'OUT';
    try {
      await apiFetch(`/v1/cash/sessions/${reconcileDetail.id}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          type,
          isExpense,
          amount: Number(fd.get('amount')),
          reason: fd.get('reason') || undefined,
          paymentMethod: fd.get('paymentMethod') || undefined,
          chartAccountId: isExpense ? fd.get('chartAccountId') || undefined : undefined,
        }),
      });
      (e.target as HTMLFormElement).reset();
      setReconcileMovementKind('IN');
      await reloadReconcileDetail(reconcileDetail.id);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  function startEditReconcileMovement(m: Movement) {
    setReconcileEditing(m);
    setReconcileEditKind(m.type === 'IN' ? 'IN' : m.isExpense ? 'EXPENSE' : 'OUT');
  }

  async function saveReconcileMovementEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reconcileDetail || !reconcileEditing) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const kind = (fd.get('editMovementKind') as MovementKind) || reconcileEditKind;
    const isExpense = kind === 'EXPENSE';
    const type = kind === 'IN' ? 'IN' : 'OUT';
    try {
      await apiFetch(
        `/v1/cash/sessions/${reconcileDetail.id}/movements/${reconcileEditing.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            type,
            isExpense,
            amount: Number(fd.get('amount')),
            reason: fd.get('reason') || undefined,
            paymentMethod: fd.get('paymentMethod') || undefined,
            chartAccountId: isExpense ? fd.get('chartAccountId') || null : null,
          }),
        },
      );
      setReconcileEditing(null);
      await reloadReconcileDetail(reconcileDetail.id);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function deleteReconcileMovement(movementId: string) {
    if (!reconcileDetail) return;
    if (!confirm('Excluir este lançamento?')) return;
    setError(null);
    try {
      await apiFetch(`/v1/cash/sessions/${reconcileDetail.id}/movements/${movementId}`, {
        method: 'DELETE',
      });
      if (reconcileEditing?.id === movementId) setReconcileEditing(null);
      await reloadReconcileDetail(reconcileDetail.id);
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  async function confirmReconciliation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!reconcileDetail) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const notes = String(fd.get('reconciliationNotes') ?? '').trim() || undefined;
    try {
      await apiFetch(`/v1/cash/sessions/${reconcileDetail.id}/reconcile`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: notes ?? 'Conferido' }),
      });
      setReconcileModalOpen(false);
      setReconcileDetail(null);
      setSuccess('Caixa conferido e marcado como conciliado.');
      load();
    } catch (err) {
      setError(parseApiError(err));
    }
  }

  const inner = (
    <>
      {!embedded ? (
        <PageIntro title="Caixa" description="Abertura de sessão, lançamentos, fechamento e conciliação." />
      ) : sessionFocus ? (
        <p className="mb-4 text-sm text-slate-600">
          Sessão de caixa selecionada — movimentos, fechamento ou conferência conforme o status.
        </p>
      ) : null}
      <ErrorBox message={error} />
      {success ? <p className="mb-4 text-sm text-emerald-700">{success}</p> : null}
      {!sessionFocus ? (
        <TabBar
          active={tab}
          onChange={setTab}
          tabs={[
            { id: 'atual', label: 'Caixa atual' },
            { id: 'historico', label: 'Histórico' },
            { id: 'pendentes', label: 'Conciliação pendente' },
          ]}
        />
      ) : null}
      {sessionFocus && !open && !reconcileModalOpen ? (
        <p className="text-sm text-slate-600">Carregando sessão…</p>
      ) : null}
      {!sessionFocus && openSessions.length > 0 ? (
        <PageCard title="Caixas abertos no sistema">
          <p className="mb-3 text-sm text-slate-600">
            Sessões ainda não fechadas (inclui dias anteriores). Retome a sua para lançar movimentos ou use o
            fechamento.
          </p>
          <ResponsiveTableWrap>
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                  <th className="px-3 py-2">Controle</th>
                  <th className="px-3 py-2">Operador</th>
                  <th className="px-3 py-2">Abertura</th>
                  <th className="px-3 py-2">Ações</th>
                </tr>
              </thead>
              <tbody>
                {openSessions.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 tabular-nums">{s.controlNumber}</td>
                    <td className="px-3 py-2">
                      {s.user.name} ({s.user.username}){s.isMine ? ' · você' : ''}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(s.openedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2">
                      {s.isMine ? (
                        <span className="flex flex-wrap gap-2">
                          <Button type="button" className="px-2 py-1 text-xs" onClick={() => void resumeSession(s.id)}>
                            Retomar
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => void closeOpenListItem(s)}
                          >
                            Fechar
                          </Button>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Outro operador</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableWrap>
        </PageCard>
      ) : null}
      {(sessionFocus || tab === 'atual') && !open && !reconcileModalOpen ? (
        <PageCard title="Abrir caixa">
          {myStaleOpens.length > 0 ? (
            <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              Você já tem caixa aberto (controle {myStaleOpens[0].controlNumber}, desde{' '}
              {new Date(myStaleOpens[0].openedAt).toLocaleString('pt-BR')}). Use <strong>Retomar</strong> acima — não
              abra outra sessão.
            </p>
          ) : null}
          <form onSubmit={openSession} className="max-w-sm">
            <Field label="Saldo inicial (R$)">
              <input name="openingBalance" type="number" step="0.01" min={0} className={inputClass} required />
            </Field>
            <SubmitButton label="Abrir sessão" disabled={myStaleOpens.length > 0} />
          </form>
        </PageCard>
      ) : null}
      {(sessionFocus || tab === 'atual') && open ? (
        <>
          <PageCard
            title="Sessão aberta"
            action={
              <Button type="button" variant="secondary" onClick={() => openCloseModal()}>
                Fechamento de caixa
              </Button>
            }
          >
            <p className="mb-2 text-sm text-slate-600">
              {open.controlNumber != null ? <>Controle {open.controlNumber} · </> : null}
              Aberto em {new Date(open.openedAt).toLocaleString('pt-BR')} — saldo inicial{' '}
              {formatBrl(Number(open.openingBalance))}
            </p>
            {new Date(open.openedAt).toDateString() !== new Date().toDateString() ? (
              <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Este caixa é de um dia anterior — finalize o fechamento assim que possível.
              </p>
            ) : null}
            {sessionSummary ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <p className="font-medium text-slate-900">Conferência (dinheiro esperado no caixa)</p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  <li>Entradas: {formatBrl(sessionSummary.inflow)}</li>
                  <li>Saídas: {formatBrl(sessionSummary.outflow)}</li>
                  <li>Despesas (em dinheiro): {formatBrl(sessionSummary.expenses)}</li>
                  <li className="font-semibold text-emerald-900">
                    Saldo esperado: {formatBrl(sessionSummary.expectedBalance)}
                  </li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">
                  Despesas entram no total de saídas e reduzem o dinheiro na conferência do fechamento.
                </p>
              </div>
            ) : null}
            <ListToolbar list={movList} onReports={() => setReportsOpen(true)} showPrint={false} searchPlaceholder="Tipo, motivo…" />
            <PaginatedTable
              headers={['Data', 'Tipo', 'Valor', 'Classificação', 'Motivo', 'Pagamento']}
              recordItems={movPag.slice}
              rows={movPag.slice.map((m) => [
                new Date(m.createdAt).toLocaleString('pt-BR'),
                cashMovementKindLabel(m),
                formatBrl(Number(m.amount)),
                m.chartAccount ? `${m.chartAccount.code} — ${m.chartAccount.name}` : '—',
                m.reason ?? '—',
                labelEnum(m.paymentMethod),
              ])}
              page={movPag.page}
              totalPages={movPag.totalPages}
              total={movPag.total}
              onPage={movPag.setPage}
            />
          </PageCard>

          <FormCadastroModal
            open={closeModalOpen}
            onClose={() => {
              setCloseModalOpen(false);
              setCloseTarget(null);
            }}
            title="Fechamento de caixa"
            hint="Informe o valor apresentado para cada forma de pagamento. O caixa passará para aguardando conciliação."
            footer={
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setCloseModalOpen(false);
                    setCloseTarget(null);
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" form="cash-close-form">
                  Confirmar fechamento
                </Button>
              </>
            }
          >
            {sessionSummary ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">Resumo para conferência</p>
                <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                  <div>
                    <dt className="text-slate-500">Saldo inicial</dt>
                    <dd className="font-medium tabular-nums">{formatBrl(sessionSummary.opening)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Entradas</dt>
                    <dd className="font-medium tabular-nums">{formatBrl(sessionSummary.inflow)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Saídas (incl. despesas)</dt>
                    <dd className="font-medium tabular-nums">{formatBrl(sessionSummary.outflow)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Despesas em dinheiro</dt>
                    <dd className="font-medium tabular-nums">{formatBrl(sessionSummary.expenses)}</dd>
                  </div>
                  {closeByPayment?.methods.map((method) => (
                    <div key={method}>
                      <dt className="text-slate-500">Esperado — {labelEnum(method)}</dt>
                      <dd className="font-medium tabular-nums">{formatBrl(closeByPayment.expected[method] ?? 0)}</dd>
                    </div>
                  ))}
                  <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                    <dt className="text-slate-500">Total esperado (sistema)</dt>
                    <dd className="text-base font-semibold text-emerald-900 tabular-nums">
                      {formatBrl(closeByPayment?.totalExpected ?? sessionSummary.expectedBalance)}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
            <form id="cash-close-form" onSubmit={closeSession}>
              <p className="mb-2 text-sm font-medium text-slate-800">Valores apresentados na conferência</p>
              <div className="mb-3 grid gap-3 sm:grid-cols-2">
                {closeByPayment?.methods.map((method) => (
                  <Field key={method} label={`${labelEnum(method)} (R$)`}>
                    <input
                      name={`presented_${method}`}
                      type="number"
                      step="0.01"
                      min={0}
                      className={inputClass}
                      required
                      value={presentedByMethod[method] ?? ''}
                      onChange={(e) =>
                        setPresentedByMethod((prev) => ({ ...prev, [method]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </div>
              {Number.isFinite(presentedTotal) ? (
                <p className="mb-3 text-sm text-slate-600">
                  Total apresentado: <span className="font-semibold tabular-nums">{formatBrl(presentedTotal)}</span>
                </p>
              ) : null}
              {closeDiff != null && closeDiff !== 0 ? (
                <p
                  className={`mb-3 text-sm ${closeDiff > 0 ? 'text-amber-800' : 'text-sky-800'}`}
                >
                  Diferença (esperado − apresentado): {formatBrl(closeDiff)}
                  {closeDiff > 0 ? ' — falta no caixa físico' : ' — sobra no caixa físico'}
                </p>
              ) : closeDiff === 0 ? (
                <p className="mb-3 text-sm text-emerald-800">Conferência: valor apresentado igual ao esperado.</p>
              ) : null}
              <Field label="Observações do fechamento">
                <input name="closingNotes" className={inputClass} placeholder="Opcional" />
              </Field>
            </form>
          </FormCadastroModal>
        </>
      ) : null}
      {!sessionFocus && tab === 'historico' ? (
        <PageCard title="Sessões recentes">
          <ListToolbar list={histList} onReports={() => setReportsOpen(true)} showPrint={false} searchPlaceholder="Operador…" />
          <PaginatedTable
            headers={['Operador', 'Abertura', 'Fechamento', 'Status', 'Saldo abertura', 'Ações']}
            recordItems={histPag.slice}
            rows={histPag.slice.map((s) => [
              `${s.user.username} (${s.user.name})`,
              new Date(s.openedAt).toLocaleString('pt-BR'),
              s.closedAt ? new Date(s.closedAt).toLocaleString('pt-BR') : '—',
              labelEnum(s.status),
              formatBrl(Number(s.openingBalance)),
              s.status === 'OPEN' ? (
                <span key={`${s.id}-act`} className="flex flex-wrap gap-1">
                  <Button type="button" className="px-2 py-1 text-xs" onClick={() => void resumeSession(s.id)}>
                    Retomar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-2 py-1 text-xs"
                    onClick={() => void closeSessionFromHistory(s)}
                  >
                    Fechar
                  </Button>
                </span>
              ) : (
                '—'
              ),
            ])}
            page={histPag.page}
            totalPages={histPag.totalPages}
            total={histPag.total}
            onPage={histPag.setPage}
          />
        </PageCard>
      ) : null}
      {!sessionFocus && tab === 'pendentes' ? (
        <PageCard title="Aguardando conciliação">
          <ListToolbar list={pendingList} onReports={() => setReportsOpen(true)} showPrint={false} searchPlaceholder="Operador…" />
          <PaginatedTable
            headers={['Operador', 'Abertura', 'Saldo fechamento', 'Conferência', 'Ações']}
            recordItems={pendingPag.slice}
            rows={pendingPag.slice.map((s) => {
              const sum = s.movements?.length
                ? summarizeCashSession(s.openingBalance, s.movements)
                : null;
              return [
                s.user.name,
                new Date(s.openedAt).toLocaleString('pt-BR'),
                s.closingBalance != null ? formatBrl(Number(s.closingBalance)) : '—',
                sum ? (
                  <span key={`${s.id}-conf`} className="text-xs text-slate-600">
                    Esperado {formatBrl(sum.expectedBalance)}
                    {sum.expenses > 0 ? ` · despesas ${formatBrl(sum.expenses)}` : ''}
                  </span>
                ) : (
                  '—'
                ),
                <Button
                  key={s.id}
                  type="button"
                  className="px-2 py-1 text-xs"
                  onClick={() => void openReconcileModal(s)}
                >
                  Conferir caixa
                </Button>,
              ];
            })}
            page={pendingPag.page}
            totalPages={pendingPag.totalPages}
            total={pendingPag.total}
            onPage={pendingPag.setPage}
          />
        </PageCard>
      ) : null}
      <ModuleReportsModal open={reportsOpen} title="Caixa" onClose={() => setReportsOpen(false)} compactLauncher wide>
        <CashReportLauncher />
      </ModuleReportsModal>

      <FormCadastroModal
        open={reconcileModalOpen}
        onClose={() => {
          setReconcileModalOpen(false);
          setReconcileDetail(null);
          setReconcileEditing(null);
          setReconcileReadOnly(false);
        }}
        title={
          reconcileDetail
            ? reconcileReadOnly
              ? `Caixa — controle ${reconcileDetail.controlNumber} (conferido)`
              : `Conferência de caixa — controle ${reconcileDetail.controlNumber}`
            : 'Conferência de caixa'
        }
        hint={
          reconcileReadOnly
            ? 'Visualização da sessão já conferida.'
            : 'Compare totais, ajuste lançamentos se necessário e só então confirme a conferência.'
        }
        size="xl"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setReconcileModalOpen(false);
                setReconcileDetail(null);
              }}
            >
              Cancelar
            </Button>
            {reconcileDetail ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  openCashReportPrint({
                    variant: 'controle',
                    from: '',
                    to: '',
                    date: '',
                    controlMin: String(reconcileDetail.controlNumber),
                    controlMax: String(reconcileDetail.controlNumber),
                  })
                }
              >
                Relatório (nova aba)
              </Button>
            ) : null}
            {!reconcileReadOnly ? (
              <Button type="submit" form="cash-reconcile-form" disabled={!reconcileDetail || reconcileLoading}>
                Confirmar conferência
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  setReconcileModalOpen(false);
                  setReconcileDetail(null);
                  setReconcileReadOnly(false);
                }}
              >
                Fechar
              </Button>
            )}
          </>
        }
      >
        {reconcileLoading || !reconcileDetail ? (
          <p className="text-sm text-slate-600">Carregando dados da sessão…</p>
        ) : (
          <>
            <div className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-slate-500">Operador:</span>{' '}
                {reconcileDetail.user.name} ({reconcileDetail.user.username})
              </p>
              <p>
                <span className="text-slate-500">Abertura:</span>{' '}
                {new Date(reconcileDetail.openedAt).toLocaleString('pt-BR')}
              </p>
              <p>
                <span className="text-slate-500">Fechamento:</span>{' '}
                {reconcileDetail.closedAt
                  ? new Date(reconcileDetail.closedAt).toLocaleString('pt-BR')
                  : '—'}
              </p>
            </div>
            {reconcileSummary ? (
              <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                <p className="font-medium text-slate-900">Totais da sessão</p>
                <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                  <li>Entradas: {formatBrl(reconcileSummary.inflow)}</li>
                  <li>Saídas: {formatBrl(reconcileSummary.outflow)}</li>
                  <li>Despesas: {formatBrl(reconcileSummary.expenses)}</li>
                  <li className="font-semibold text-emerald-900">
                    Esperado (sistema): {formatBrl(reconcileSummary.expectedBalance)}
                  </li>
                  <li className="font-semibold sm:col-span-2">
                    Apresentado no fechamento:{' '}
                    {reconcileDetail.closingBalance != null
                      ? formatBrl(Number(reconcileDetail.closingBalance))
                      : '—'}
                  </li>
                  {reconcileDetail.closingBreakdown &&
                  typeof reconcileDetail.closingBreakdown === 'object' ? (
                    <li className="sm:col-span-2 text-xs text-slate-600">
                      {Object.entries(reconcileDetail.closingBreakdown).map(([method, amount]) => (
                        <span key={method} className="mr-3 inline-block tabular-nums">
                          {labelEnum(method)}: {formatBrl(Number(amount))}
                        </span>
                      ))}
                    </li>
                  ) : null}
                </ul>
                {reconcileDiff != null && reconcileDiff !== 0 ? (
                  <p className={`mt-2 text-sm ${reconcileDiff > 0 ? 'text-amber-800' : 'text-sky-800'}`}>
                    Diferença (esperado − apresentado): {formatBrl(reconcileDiff)}
                  </p>
                ) : reconcileDiff === 0 ? (
                  <p className="mt-2 text-sm text-emerald-800">Valores conferidos — sem diferença.</p>
                ) : null}
              </div>
            ) : null}
            {reconcileDetail.closingNotes ? (
              <p className="mb-3 text-sm text-slate-600">
                Obs. do operador no fechamento: {reconcileDetail.closingNotes}
              </p>
            ) : null}

            {!reconcileReadOnly ? (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <p className="mb-2 text-sm font-medium text-emerald-950">Novo lançamento na conferência</p>
              <form onSubmit={addReconcileMovement} className="grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="movementKind" value={reconcileMovementKind} />
                <Field label="Tipo">
                  <select
                    className={inputClass}
                    value={reconcileMovementKind}
                    onChange={(e) => setReconcileMovementKind(e.target.value as MovementKind)}
                  >
                    <option value="IN">Entrada</option>
                    <option value="OUT">Saída</option>
                    <option value="EXPENSE">Despesa</option>
                  </select>
                </Field>
                <Field label="Valor (R$)">
                  <input name="amount" type="number" step="0.01" min={0} className={inputClass} required />
                </Field>
                {reconcileMovementKind === 'EXPENSE' ? (
                  <input type="hidden" name="paymentMethod" value="CASH" />
                ) : (
                  <Field label="Forma pagamento">
                    <select name="paymentMethod" className={inputClass} defaultValue="CASH">
                      <option value="CASH">Dinheiro</option>
                      <option value="PIX">PIX</option>
                      <option value="CARD">Cartão</option>
                      <option value="TRANSFER">Transferência</option>
                    </select>
                  </Field>
                )}
                {reconcileMovementKind === 'EXPENSE' ? (
                  <Field label="Centro de custo (conta contábil)">
                    <ChartAccountSelect flow="payable" allowEmpty emptyLabel="Sem classificação" />
                  </Field>
                ) : null}
                <div className={reconcileMovementKind === 'EXPENSE' ? 'sm:col-span-2' : ''}>
                  <Field label="Motivo">
                    <input name="reason" className={inputClass} />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" className="text-sm">
                    Incluir lançamento
                  </Button>
                </div>
              </form>
            </div>
            ) : null}

            {!reconcileReadOnly && reconcileEditing ? (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <p className="mb-2 text-sm font-medium text-amber-950">Editar lançamento</p>
                <form onSubmit={saveReconcileMovementEdit} className="grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="editMovementKind" value={reconcileEditKind} />
                  <Field label="Tipo">
                    <select
                      className={inputClass}
                      value={reconcileEditKind}
                      onChange={(e) => setReconcileEditKind(e.target.value as MovementKind)}
                    >
                      <option value="IN">Entrada</option>
                      <option value="OUT">Saída</option>
                      <option value="EXPENSE">Despesa</option>
                    </select>
                  </Field>
                  <Field label="Valor (R$)">
                    <input
                      name="amount"
                      type="number"
                      step="0.01"
                      min={0}
                      className={inputClass}
                      required
                      defaultValue={reconcileEditing.amount}
                    />
                  </Field>
                  {reconcileEditKind === 'EXPENSE' ? (
                    <input type="hidden" name="paymentMethod" value="CASH" />
                  ) : (
                    <Field label="Forma pagamento">
                      <select
                        name="paymentMethod"
                        className={inputClass}
                        defaultValue={reconcileEditing.paymentMethod ?? 'CASH'}
                      >
                        <option value="CASH">Dinheiro</option>
                        <option value="PIX">PIX</option>
                        <option value="CARD">Cartão</option>
                        <option value="TRANSFER">Transferência</option>
                      </select>
                    </Field>
                  )}
                  {reconcileEditKind === 'EXPENSE' ? (
                    <Field label="Centro de custo (conta contábil)">
                      <ChartAccountSelect
                        key={reconcileEditing.id}
                        flow="payable"
                        allowEmpty
                        emptyLabel="Sem classificação"
                        defaultValue={reconcileEditing.chartAccountId ?? ''}
                      />
                    </Field>
                  ) : null}
                  <div className={reconcileEditKind === 'EXPENSE' ? 'sm:col-span-2' : ''}>
                    <Field label="Motivo">
                      <input
                        name="reason"
                        className={inputClass}
                        defaultValue={reconcileEditing.reason ?? ''}
                      />
                    </Field>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:col-span-2">
                    <Button type="submit" className="text-sm">
                      Salvar alteração
                    </Button>
                    <Button type="button" variant="secondary" className="text-sm" onClick={() => setReconcileEditing(null)}>
                      Cancelar edição
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}

            <div className="mb-4 max-h-52 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr className="text-left text-slate-600">
                    <th className="px-2 py-1">Data</th>
                    <th className="px-2 py-1">Tipo</th>
                    <th className="px-2 py-1 text-right">Valor</th>
                    <th className="px-2 py-1">Motivo</th>
                    <th className="px-2 py-1">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {reconcileDetail.movements.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-slate-500">
                        Sem movimentações.
                      </td>
                    </tr>
                  ) : (
                    reconcileDetail.movements.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className="px-2 py-1 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-2 py-1">{cashMovementKindLabel(m)}</td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {formatBrl(Number(m.amount))}
                        </td>
                        <td className="px-2 py-1">{m.reason ?? '—'}</td>
                        <td className="px-2 py-1">
                          {!reconcileReadOnly ? (
                            <span className="flex flex-wrap gap-1">
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-1.5 py-0.5 text-[10px]"
                                onClick={() => startEditReconcileMovement(m)}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="px-1.5 py-0.5 text-[10px]"
                                onClick={() => void deleteReconcileMovement(m.id)}
                              >
                                Excluir
                              </Button>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {!reconcileReadOnly ? (
              <form id="cash-reconcile-form" onSubmit={confirmReconciliation}>
                <Field label="Parecer da conferência">
                  <textarea
                    name="reconciliationNotes"
                    className={`${inputClass} min-h-[72px]`}
                    placeholder="Ex.: Conferido com operador, diferença justificada…"
                    value={reconcileNotes}
                    onChange={(e) => setReconcileNotes(e.target.value)}
                  />
                </Field>
              </form>
            ) : reconcileNotes ? (
              <p className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">Parecer da conferência:</span> {reconcileNotes}
              </p>
            ) : null}
          </>
        )}
      </FormCadastroModal>
    </>
  );

  if (embedded) return inner;
  return <AdminShell title="Financeiro — Caixa">{inner}</AdminShell>;
}
