'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { FormCadastroModal } from '@/components/crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { cashSessionStatusUi, isCashSessionClosed, varianceDisplayClass } from '@/lib/cash-session-status';
import {
  cashMovementKindLabel,
  summarizeCashSession,
  summarizeCashSessionByPaymentMethod,
} from '@/lib/cash-session-summary';
import { errorMessage, labelEnum } from '@/lib/labels';
import { formatBrl } from '@/lib/money';
import { formatRecordControl } from '@/lib/record-control';
import { sessionHasPermission, readSession } from '@/lib/session';

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

type Session = {
  id: string;
  controlNumber: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingBalance: string;
  closingBalance: string | null;
  closingBreakdown?: Record<string, number> | null;
  closingNotes: string | null;
  reconciliationNotes?: string | null;
  user: { name: string; username: string };
  movements: Movement[];
};

type ManagementLoad = {
  mode: 'operate' | 'reconcile' | 'view';
  isOwner: boolean;
  session: Session;
};

export type CashSessionFooterState = {
  readOnly: boolean;
  saving: boolean;
  saveDraft: () => void;
  canReconcile: boolean;
  confirmReconciliation: () => void;
};

export function CashSessionDetail({
  sessionId,
  embeddedInModal,
  onListChanged,
  onFooterState,
  onAfterReconciled,
  toolbarExtra,
}: {
  sessionId: string;
  /** Dentro do modal da listagem — oculta “Voltar à lista”. */
  embeddedInModal?: boolean;
  onListChanged?: () => void;
  /** Sincroniza botão Gravar no rodapé do modal pai. */
  onFooterState?: (state: CashSessionFooterState) => void;
  /** Após conferência concluída (ex.: fechar modal da listagem). */
  onAfterReconciled?: () => void;
  toolbarExtra?: ReactNode;
}) {
  const router = useRouter();
  const [load, setLoad] = useState<ManagementLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reconciliationNotes, setReconciliationNotes] = useState('');
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [presentedByMethod, setPresentedByMethod] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const applyManagement = useCallback((res: ManagementLoad) => {
    setLoad(res);
    setReconciliationNotes(res.session.reconciliationNotes ?? res.session.closingNotes ?? '');
  }, []);

  const reload = useCallback(() => {
    void apiFetch<ManagementLoad>(`/v1/cash/sessions/${sessionId}/management`)
      .then(applyManagement)
      .catch((e) => setError(errorMessage(e)));
  }, [sessionId, applyManagement]);

  const notifyList = useCallback(() => {
    onListChanged?.();
  }, [onListChanged]);

  useEffect(() => {
    reload();
  }, [reload]);

  const session = load?.session;
  const readOnly = load?.mode === 'view' || session?.status === 'RECONCILED';
  const canReconcile =
    session?.status === 'PENDING_RECONCILIATION' &&
    sessionHasPermission(readSession(), 'cash.reconcile');
  const canExpense =
    session != null &&
    session.status !== 'RECONCILED' &&
    (session.status === 'PENDING_RECONCILIATION'
      ? sessionHasPermission(readSession(), 'cash.reconcile') ||
        sessionHasPermission(readSession(), 'cash.write')
      : Boolean(load?.isOwner && session.status === 'OPEN'));
  const canClose = load?.mode === 'operate' && session?.status === 'OPEN' && load.isOwner;

  const summary = useMemo(() => {
    if (!session) return null;
    return summarizeCashSession(session.openingBalance, session.movements);
  }, [session]);

  const closingBalance = session?.closingBalance != null ? Number(session.closingBalance) : null;
  const variance =
    summary && closingBalance != null
      ? Math.round((closingBalance - summary.expectedBalance) * 100) / 100
      : null;

  const closeByPayment = useMemo(() => {
    if (!session) return null;
    return summarizeCashSessionByPaymentMethod(session.openingBalance, session.movements);
  }, [session]);

  function openCloseModal() {
    if (!session || !closeByPayment) return;
    setPresentedByMethod(
      Object.fromEntries(closeByPayment.methods.map((m) => [m, String(closeByPayment.expected[m] ?? 0)])),
    );
    setCloseOpen(true);
  }

  const saveDraft = useCallback(async () => {
    if (!session) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await apiFetch<Session>(`/v1/cash/sessions/${session.id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ reconciliationNotes: reconciliationNotes.trim() || undefined }),
      });
      setLoad((prev) =>
        prev
          ? {
              ...prev,
              session: {
                ...prev.session,
                reconciliationNotes: updated.reconciliationNotes ?? null,
              },
            }
          : prev,
      );
      setSuccess('Observações gravadas.');
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [session, reconciliationNotes]);

  const confirmReconciliation = useCallback(async () => {
    if (!session || !canReconcile) return;
    if (!window.confirm('Confirmar conferência? O caixa será marcado como conferido.')) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiFetch(`/v1/cash/sessions/${session.id}/draft`, {
        method: 'PATCH',
        body: JSON.stringify({ reconciliationNotes: reconciliationNotes.trim() || undefined }),
      });
      await apiFetch(`/v1/cash/sessions/${session.id}/reconcile`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: reconciliationNotes.trim() || 'Conferido' }),
      });
      notifyList();
      onAfterReconciled?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }, [session, canReconcile, reconciliationNotes, notifyList, onAfterReconciled]);

  const saveDraftRef = useRef(saveDraft);
  const confirmReconciliationRef = useRef(confirmReconciliation);
  saveDraftRef.current = saveDraft;
  confirmReconciliationRef.current = confirmReconciliation;

  useEffect(() => {
    if (!embeddedInModal || !onFooterState) return;
    onFooterState({
      readOnly,
      saving,
      saveDraft: () => void saveDraftRef.current(),
      canReconcile: Boolean(canReconcile),
      confirmReconciliation: () => void confirmReconciliationRef.current(),
    });
  }, [embeddedInModal, onFooterState, readOnly, saving, canReconcile]);

  async function addExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session || !canExpense) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/v1/cash/sessions/${session.id}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'OUT',
          isExpense: true,
          amount: Number(fd.get('amount')),
          reason: fd.get('reason') || undefined,
          paymentMethod: 'CASH',
          chartAccountId: fd.get('chartAccountId') || undefined,
        }),
      });
      setExpenseOpen(false);
      setSuccess('Despesa registrada.');
      reload();
      notifyList();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function closeSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!session || !closeByPayment) return;
    setError(null);
    const closingByMethod: Record<string, number> = {};
    for (const method of closeByPayment.methods) {
      const v = Number(presentedByMethod[method] ?? 0);
      if (!Number.isFinite(v) || v < 0) {
        setError(`Informe um valor válido para ${labelEnum(method)}.`);
        return;
      }
      closingByMethod[method] = Math.round(v * 100) / 100;
    }
    const closingBalanceTotal = Math.round(Object.values(closingByMethod).reduce((s, n) => s + n, 0) * 100) / 100;
    const fd = new FormData(e.currentTarget);
    try {
      const updated = await apiFetch<Session>(`/v1/cash/sessions/${session.id}/close`, {
        method: 'POST',
        body: JSON.stringify({
          closingBalance: closingBalanceTotal,
          closingByMethod,
          closingNotes: fd.get('closingNotes') || undefined,
        }),
      });
      setCloseOpen(false);
      const canConfer = sessionHasPermission(readSession(), 'cash.reconcile');
      setSuccess(
        canConfer
          ? 'Caixa fechado. Revise os totais e use «Conferir caixa» no rodapé para concluir.'
          : 'Caixa fechado — aguardando conferência.',
      );
      setLoad((prev) =>
        prev
          ? {
              ...prev,
              mode: canConfer ? 'reconcile' : 'view',
              session: {
                ...prev.session,
                status: updated.status,
                closedAt: updated.closedAt,
                closingBalance: updated.closingBalance,
                closingBreakdown: updated.closingBreakdown ?? null,
                closingNotes: updated.closingNotes ?? null,
              },
            }
          : prev,
      );
      notifyList();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  if (!session) {
    return <p className="text-sm text-slate-600">{error ? null : 'Carregando sessão…'}</p>;
  }

  const statusUi = cashSessionStatusUi(session.status);

  return (
    <>
      <ErrorBox message={error} />
      {success ? <p className="mb-3 text-sm text-emerald-700">{success}</p> : null}
      {canReconcile && session.status === 'PENDING_RECONCILIATION' ? (
        <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Este caixa está <strong>pendente de conferência</strong>. «Gravar observações» salva apenas o parecer;
          para finalizar, use <strong>Conferir caixa</strong> no rodapé.
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-slate-900">
            Caixa {formatRecordControl(session.controlNumber)}
          </p>
          <p className="text-sm text-slate-600">
            {session.user.name} ({session.user.username}) · Abertura{' '}
            {new Date(session.openedAt).toLocaleString('pt-BR')}
            {session.closedAt
              ? ` · Fechamento ${new Date(session.closedAt).toLocaleString('pt-BR')}`
              : null}
          </p>
        </div>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusUi.className}`}>
          {statusUi.label}
          {isCashSessionClosed(session.status) && session.status !== 'RECONCILED' ? (
            <span className="ml-1 font-normal opacity-80">(fechado)</span>
          ) : null}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {!readOnly && !embeddedInModal ? (
          <Button type="button" onClick={() => void saveDraft()} disabled={saving}>
            Gravar
          </Button>
        ) : null}
        {canReconcile && !embeddedInModal ? (
          <Button type="button" variant="secondary" onClick={() => void confirmReconciliation()} disabled={saving}>
            Conferir caixa
          </Button>
        ) : null}
        {canExpense ? (
          <Button type="button" variant="secondary" onClick={() => setExpenseOpen(true)}>
            Adicionar despesa
          </Button>
        ) : null}
        {canClose ? (
          <Button type="button" variant="secondary" onClick={openCloseModal}>
            Fechamento de caixa
          </Button>
        ) : null}
        {toolbarExtra}
        {!embeddedInModal ? (
          <Button type="button" variant="secondary" onClick={() => router.push('/vendas/caixa')}>
            Voltar à lista
          </Button>
        ) : null}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase text-slate-500">Total vendido (entradas)</p>
          <p className="text-lg font-semibold tabular-nums">{formatBrl(summary?.inflow ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase text-slate-500">Total apresentado</p>
          <p className="text-lg font-semibold tabular-nums">
            {closingBalance != null ? formatBrl(closingBalance) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <p className="text-[11px] uppercase text-slate-500">Diferença</p>
          <p className={`text-lg tabular-nums ${varianceDisplayClass(variance)}`}>
            {variance != null ? formatBrl(variance) : '—'}
          </p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2">
          <p className="text-[11px] uppercase text-slate-500">Saldo esperado</p>
          <p className="text-lg font-semibold tabular-nums text-emerald-900">
            {formatBrl(summary?.expectedBalance ?? 0)}
          </p>
        </div>
      </div>

      {!readOnly ? (
        <Field label="Observações / parecer da conferência">
          <textarea
            className={`${inputClass} min-h-[72px]`}
            value={reconciliationNotes}
            onChange={(e) => setReconciliationNotes(e.target.value)}
            placeholder="Registre o parecer antes de conferir…"
          />
        </Field>
      ) : session.reconciliationNotes || session.closingNotes ? (
        <p className="mb-4 text-sm text-slate-600">
          <span className="font-medium">Observações:</span>{' '}
          {session.reconciliationNotes ?? session.closingNotes}
        </p>
      ) : null}

      <PageCard title="Movimentações" className="mt-4">
        <ResponsiveTableWrap>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-600">
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2 text-right">Valor</th>
                <th className="px-3 py-2">Centro de custo</th>
                <th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody>
              {session.movements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Nenhum lançamento.
                  </td>
                </tr>
              ) : (
                session.movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(m.createdAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2">{cashMovementKindLabel(m)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBrl(Number(m.amount))}</td>
                    <td className="px-3 py-2">
                      {m.chartAccount ? `${m.chartAccount.code} — ${m.chartAccount.name}` : '—'}
                    </td>
                    <td className="px-3 py-2">{m.reason ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      </PageCard>

      <FormCadastroModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        backdropClassName="z-[110]"
        title="Adicionar despesa"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setExpenseOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="cash-expense-form">
              Incluir despesa
            </Button>
          </>
        }
      >
        <form id="cash-expense-form" onSubmit={addExpense} className="grid gap-3">
          <Field label="Valor (R$)">
            <input name="amount" type="number" step="0.01" min={0} className={inputClass} required />
          </Field>
          <Field label="Centro de custo">
            <ChartAccountSelect flow="payable" allowEmpty emptyLabel="Selecione…" />
          </Field>
          <Field label="Observação">
            <input name="reason" className={inputClass} placeholder="Descrição da despesa" />
          </Field>
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        backdropClassName="z-[110]"
        title="Fechamento de caixa"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCloseOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="cash-close-form">
              Confirmar fechamento
            </Button>
          </>
        }
      >
        <form id="cash-close-form" onSubmit={closeSession}>
          <p className="mb-3 text-sm text-slate-600">Informe os valores apresentados por forma de pagamento.</p>
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            {closeByPayment?.methods.map((method) => (
              <Field key={method} label={`${labelEnum(method)} (R$)`}>
                <input
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
          <Field label="Observações do fechamento">
            <input name="closingNotes" className={inputClass} />
          </Field>
        </form>
      </FormCadastroModal>
    </>
  );
}
