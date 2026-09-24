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
import { cashMovementKindLabel, summarizeCashSession } from '@/lib/cash-session-summary';
import { errorMessage, labelEnum } from '@/lib/labels';

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
  closingNotes: string | null;
  user: { name: string; username: string };
  movements: Movement[];
};

type MovementKind = 'IN' | 'OUT' | 'EXPENSE';

export default function FinanceiroCaixaPage() {
  const [tab, setTab] = useState('atual');
  const [open, setOpen] = useState<OpenSession | null>(null);
  const [history, setHistory] = useState<SessionRow[]>([]);
  const [pending, setPending] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [movementKind, setMovementKind] = useState<MovementKind>('IN');
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [presentedCash, setPresentedCash] = useState('');
  const [openSessions, setOpenSessions] = useState<OpenSessionListItem[]>([]);
  const [closeTarget, setCloseTarget] = useState<OpenSession | null>(null);
  const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
  const [reconcileDetail, setReconcileDetail] = useState<PendingReconcileSession | null>(null);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconcileLoading, setReconcileLoading] = useState(false);
  const [reconcileMovementKind, setReconcileMovementKind] = useState<MovementKind>('IN');
  const [reconcileEditing, setReconcileEditing] = useState<Movement | null>(null);
  const [reconcileEditKind, setReconcileEditKind] = useState<MovementKind>('IN');

  const sessionForClose = closeTarget ?? open;

  const sessionSummary = useMemo(() => {
    if (!sessionForClose) return null;
    return summarizeCashSession(sessionForClose.openingBalance, sessionForClose.movements);
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

  async function addMovement(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!open) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const kind = (fd.get('movementKind') as MovementKind) || movementKind;
    const isExpense = kind === 'EXPENSE';
    const type = kind === 'IN' ? 'IN' : 'OUT';
    try {
      await apiFetch(`/v1/cash/sessions/${open.id}/movements`, {
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
      setMovementKind('IN');
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
    const sum = summarizeCashSession(target.openingBalance, target.movements);
    setPresentedCash(sum.expectedBalance.toFixed(2));
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
    const closingBalance = Number(fd.get('closingBalance'));
    if (!Number.isFinite(closingBalance) || closingBalance < 0) {
      setError('Informe o valor apresentado no caixa.');
      return;
    }
    try {
      await apiFetch(`/v1/cash/sessions/${target.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          closingBalance,
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

  const presentedNum = presentedCash === '' ? NaN : Number(presentedCash);
  const closeDiff =
    sessionSummary && Number.isFinite(presentedNum)
      ? Math.round((sessionSummary.expectedBalance - presentedNum) * 100) / 100
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

  return (
    <AdminShell title="Financeiro — Caixa">
      <PageIntro title="Caixa" description="Abertura de sessão, lançamentos, fechamento e conciliação." />
      <ErrorBox message={error} />
      {success ? <p className="mb-4 text-sm text-emerald-700">{success}</p> : null}
      <TabBar
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'atual', label: 'Caixa atual' },
          { id: 'historico', label: 'Histórico' },
          { id: 'pendentes', label: 'Conciliação pendente' },
        ]}
      />
      {openSessions.length > 0 ? (
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
      {tab === 'atual' && !open ? (
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
      {tab === 'atual' && open ? (
        <>
          <PageCard
            title="Sessão aberta"
            action={
              <Button type="button" variant="secondary" onClick={openCloseModal}>
                Fechamento de caixa
              </Button>
            }
          >
            <p className="mb-2 text-sm text-slate-600">
              {open.controlNumber != null ? <>Controle {open.controlNumber} · </> : null}
              Aberto em {new Date(open.openedAt).toLocaleString('pt-BR')} — saldo inicial R${' '}
              {Number(open.openingBalance).toFixed(2)}
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
                  <li>Entradas: R$ {sessionSummary.inflow.toFixed(2)}</li>
                  <li>Saídas: R$ {sessionSummary.outflow.toFixed(2)}</li>
                  <li>Despesas (em dinheiro): R$ {sessionSummary.expenses.toFixed(2)}</li>
                  <li className="font-semibold text-emerald-900">
                    Saldo esperado: R$ {sessionSummary.expectedBalance.toFixed(2)}
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
                `R$ ${Number(m.amount).toFixed(2)}`,
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
          <PageCard title="Lançar movimento">
            <form onSubmit={addMovement} className="grid max-w-2xl gap-3 md:grid-cols-2">
              <input type="hidden" name="movementKind" value={movementKind} />
              <Field label="Tipo">
                <select
                  name="movementKindUi"
                  className={inputClass}
                  required
                  value={movementKind}
                  onChange={(e) => setMovementKind(e.target.value as MovementKind)}
                >
                  <option value="IN">Entrada</option>
                  <option value="OUT">Saída</option>
                  <option value="EXPENSE">Despesa</option>
                </select>
              </Field>
              <Field label="Valor (R$)">
                <input name="amount" type="number" step="0.01" min={0} className={inputClass} required />
              </Field>
              {movementKind === 'EXPENSE' ? (
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
              {movementKind === 'EXPENSE' ? (
                <Field label="Centro de custo (conta contábil)">
                  <ChartAccountSelect flow="payable" allowEmpty emptyLabel="Sem classificação" />
                </Field>
              ) : (
                <div className="hidden md:block" />
              )}
              <div className={movementKind === 'EXPENSE' ? 'md:col-span-2' : ''}>
                <Field label="Motivo">
                  <input
                    name="reason"
                    className={inputClass}
                    placeholder={movementKind === 'EXPENSE' ? 'Ex.: combustível, material de limpeza…' : ''}
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <SubmitButton label="Lançar" />
              </div>
            </form>
          </PageCard>

          <FormCadastroModal
            open={closeModalOpen}
            onClose={() => {
              setCloseModalOpen(false);
              setCloseTarget(null);
            }}
            title="Fechamento de caixa"
            hint="Informe o valor apresentado na conferência física. O caixa passará para aguardando conciliação."
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
                    <dd className="font-medium tabular-nums">R$ {sessionSummary.opening.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Entradas</dt>
                    <dd className="font-medium tabular-nums">R$ {sessionSummary.inflow.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Saídas (incl. despesas)</dt>
                    <dd className="font-medium tabular-nums">R$ {sessionSummary.outflow.toFixed(2)}</dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Despesas em dinheiro</dt>
                    <dd className="font-medium tabular-nums">R$ {sessionSummary.expenses.toFixed(2)}</dd>
                  </div>
                  <div className="sm:col-span-2 border-t border-slate-200 pt-2">
                    <dt className="text-slate-500">Total esperado no caixa (sistema)</dt>
                    <dd className="text-base font-semibold text-emerald-900 tabular-nums">
                      R$ {sessionSummary.expectedBalance.toFixed(2)}
                    </dd>
                  </div>
                </dl>
              </div>
            ) : null}
            <form id="cash-close-form" onSubmit={closeSession}>
              <Field label="Valor apresentado no caixa (R$)">
                <input
                  name="closingBalance"
                  type="number"
                  step="0.01"
                  min={0}
                  className={inputClass}
                  required
                  value={presentedCash}
                  onChange={(e) => setPresentedCash(e.target.value)}
                />
              </Field>
              {closeDiff != null && closeDiff !== 0 ? (
                <p
                  className={`mb-3 text-sm ${closeDiff > 0 ? 'text-amber-800' : 'text-sky-800'}`}
                >
                  Diferença (esperado − apresentado): R$ {closeDiff.toFixed(2)}
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
      {tab === 'historico' ? (
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
              `R$ ${Number(s.openingBalance).toFixed(2)}`,
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
      {tab === 'pendentes' ? (
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
                s.closingBalance != null ? `R$ ${Number(s.closingBalance).toFixed(2)}` : '—',
                sum ? (
                  <span key={`${s.id}-conf`} className="text-xs text-slate-600">
                    Esperado R$ {sum.expectedBalance.toFixed(2)}
                    {sum.expenses > 0 ? ` · despesas R$ ${sum.expenses.toFixed(2)}` : ''}
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
        }}
        title={
          reconcileDetail
            ? `Conferência de caixa — controle ${reconcileDetail.controlNumber}`
            : 'Conferência de caixa'
        }
        hint="Compare totais, ajuste lançamentos se necessário e só então confirme a conferência."
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
            <Button type="submit" form="cash-reconcile-form" disabled={!reconcileDetail || reconcileLoading}>
              Confirmar conferência
            </Button>
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
                  <li>Entradas: R$ {reconcileSummary.inflow.toFixed(2)}</li>
                  <li>Saídas: R$ {reconcileSummary.outflow.toFixed(2)}</li>
                  <li>Despesas: R$ {reconcileSummary.expenses.toFixed(2)}</li>
                  <li className="font-semibold text-emerald-900">
                    Esperado (sistema): R$ {reconcileSummary.expectedBalance.toFixed(2)}
                  </li>
                  <li className="font-semibold sm:col-span-2">
                    Apresentado no fechamento: R${' '}
                    {reconcileDetail.closingBalance != null
                      ? Number(reconcileDetail.closingBalance).toFixed(2)
                      : '—'}
                  </li>
                </ul>
                {reconcileDiff != null && reconcileDiff !== 0 ? (
                  <p className={`mt-2 text-sm ${reconcileDiff > 0 ? 'text-amber-800' : 'text-sky-800'}`}>
                    Diferença (esperado − apresentado): R$ {reconcileDiff.toFixed(2)}
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

            {reconcileEditing ? (
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
                          R$ {Number(m.amount).toFixed(2)}
                        </td>
                        <td className="px-2 py-1">{m.reason ?? '—'}</td>
                        <td className="px-2 py-1">
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
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
          </>
        )}
      </FormCadastroModal>
    </AdminShell>
  );
}
