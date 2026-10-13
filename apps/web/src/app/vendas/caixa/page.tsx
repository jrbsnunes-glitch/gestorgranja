'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  CashSessionDetail,
  type CashSessionFooterState,
} from '@/components/cash/cash-session-detail';
import { CashReportLauncher } from '@/components/cash-report-launcher';
import { FormCadastroModal, ModuleReportsModal, PageIntro } from '@/components/crud';
import { FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { cashSessionStatusUi, varianceDisplayClass } from '@/lib/cash-session-status';
import { formatBrl } from '@/lib/money';
import { CASH_SESSION_QUERY_PARAM } from '@/lib/cash-session-nav';
import { formatRecordControl } from '@/lib/record-control';
import { isAdminSession, readSession, sessionHasPermission } from '@/lib/session';

const PAGE_SIZE = 30;

type SessionSummary = {
  id: string;
  controlNumber: number;
  status: string;
  reconciliationStatusLabel: string;
  openedAt: string;
  closedAt: string | null;
  salesInflow: number;
  closingBalance: number | null;
  variance: number | null;
  isMine: boolean;
  user: { name: string; username: string };
};

type FilterState = {
  from: string;
  to: string;
  abertos: boolean;
  fechados: boolean;
  conferidos: boolean;
  pendente: boolean;
};

function defaultFilters(): FilterState {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const today = `${y}-${m}-${d}`;
  return {
    from: `${y}-${m}-01`,
    to: today,
    abertos: true,
    fechados: true,
    conferidos: true,
    pendente: true,
  };
}

function buildStatusQuery(f: FilterState): string {
  const set = new Set<string>();
  if (f.abertos) set.add('OPEN');
  if (f.pendente) set.add('PENDING_RECONCILIATION');
  if (f.conferidos) set.add('RECONCILED');
  if (f.fechados) {
    set.add('PENDING_RECONCILIATION');
    set.add('RECONCILED');
  }
  if (set.size === 0 || set.size >= 3) return '';
  return [...set].join(',');
}

function VendasCaixaListPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<SessionSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<FilterState>(() => defaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => defaultFilters());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sessionModalId, setSessionModalId] = useState<string | null>(null);
  const [sessionFooter, setSessionFooter] = useState<CashSessionFooterState | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const sessionFromUrl = searchParams.get(CASH_SESSION_QUERY_PARAM);

  useEffect(() => {
    if (sessionFromUrl) setSessionModalId(sessionFromUrl);
  }, [sessionFromUrl]);

  const closeSessionModal = useCallback(() => {
    setSessionModalId(null);
    setSessionFooter(null);
    router.replace('/vendas/caixa', { scroll: false });
  }, [router]);

  const load = useCallback(() => {
    const q = new URLSearchParams({
      take: String(PAGE_SIZE),
      skip: String((page - 1) * PAGE_SIZE),
    });
    const status = buildStatusQuery(appliedFilters);
    if (status) q.set('status', status);
    if (appliedFilters.from) q.set('from', appliedFilters.from);
    if (appliedFilters.to) q.set('to', appliedFilters.to);
    void apiFetch<{ total: number; items: SessionSummary[] }>(`/v1/cash/sessions/summary?${q.toString()}`)
      .then((res) => {
        setRows(res.items);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, [page, appliedFilters]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedRow = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  function canOpenRow(row: SessionSummary) {
    const session = readSession();
    if (!session) return false;
    if (isAdminSession(session) || sessionHasPermission(session, 'cash.reconcile')) return true;
    if (row.status === 'OPEN') {
      return row.isMine && sessionHasPermission(session, 'cash.write');
    }
    if (row.status === 'PENDING_RECONCILIATION') {
      return (
        sessionHasPermission(session, 'cash.reconcile') || sessionHasPermission(session, 'cash.read')
      );
    }
    return sessionHasPermission(session, 'cash.read');
  }

  function openSession(row: SessionSummary) {
    if (!canOpenRow(row)) return;
    setSessionModalId(row.id);
    setSelectedId(row.id);
    router.replace(`/vendas/caixa?${CASH_SESSION_QUERY_PARAM}=${encodeURIComponent(row.id)}`, {
      scroll: false,
    });
  }

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setPage(1);
    setFiltersOpen(false);
  }

  function openConferenciaExterna() {
    const row = selectedRow;
    if (!row || row.status !== 'PENDING_RECONCILIATION') {
      setError('Selecione um caixa com status pendente de conferência.');
      return;
    }
    if (!sessionHasPermission(readSession(), 'cash.reconcile')) {
      setError('Sem permissão para conferir caixas.');
      return;
    }
    openSession(row);
  }

  return (
    <AdminShell title="Caixas">
      <PageIntro
        title="Caixas"
        description="Todas as sessões de caixa, do mais recente ao mais antigo. Clique na linha para abrir o registro."
        showModuleTabs={false}
      />
      <ErrorBox message={error} />

      <div className="mb-4 flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={() => setFiltersOpen(true)}>
          Filtros
        </Button>
        <Button type="button" variant="secondary" onClick={() => setReportsOpen(true)}>
          Impressões
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={openConferenciaExterna}
          disabled={selectedRow?.status !== 'PENDING_RECONCILIATION'}
          title="Selecione uma linha pendente de conferência"
        >
          Conferência
        </Button>
      </div>

      <ResponsiveTableWrap>
        <table className="w-full min-w-[880px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="w-10 px-2 py-2" aria-label="Seleção" />
              <th className="px-3 py-2">Controle</th>
              <th className="px-3 py-2">Situação</th>
              <th className="px-3 py-2">Operador</th>
              <th className="px-3 py-2">Abertura</th>
              <th className="px-3 py-2 text-right">Total vendido</th>
              <th className="px-3 py-2 text-right">Total apresentado</th>
              <th className="px-3 py-2 text-right">Diferença</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma sessão encontrada.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const clickable = canOpenRow(row);
                const statusUi = cashSessionStatusUi(row.status);
                return (
                  <tr
                    key={row.id}
                    onClick={() => openSession(row)}
                    className={`border-b border-slate-100 last:border-0 ${
                      clickable ? 'cursor-pointer hover:bg-emerald-50/80' : ''
                    } ${selectedId === row.id ? 'bg-emerald-50/50' : ''}`}
                  >
                    <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="radio"
                        name="cash-select"
                        checked={selectedId === row.id}
                        onChange={() => setSelectedId(row.id)}
                        aria-label={`Selecionar caixa ${row.controlNumber}`}
                      />
                    </td>
                    <td className="px-3 py-2.5 tabular-nums font-medium">{formatRecordControl(row.controlNumber)}</td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusUi.className}`}>
                        {statusUi.label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {row.user.name}
                      <span className="text-slate-500"> ({row.user.username})</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {new Date(row.openedAt).toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(row.salesInflow)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatBrl(row.closingBalance)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums ${varianceDisplayClass(row.variance)}`}>
                      {row.variance != null ? formatBrl(row.variance) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ResponsiveTableWrap>

      {totalPages > 1 ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="text-slate-600">
            {total} registro(s) · página {page} de {totalPages}
          </p>
          <span className="flex gap-2">
            <Button type="button" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Anterior
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </Button>
          </span>
        </div>
      ) : null}

      <FormCadastroModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filtros — caixas"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDraftFilters(defaultFilters())}>
              Limpar
            </Button>
            <Button type="button" onClick={applyFilters}>
              Aplicar
            </Button>
          </>
        }
      >
        <FilterPeriodRangeFields
          idPrefix="cash-list"
          from={draftFilters.from}
          to={draftFilters.to}
          onFromChange={(from) => setDraftFilters((f) => ({ ...f, from }))}
          onToChange={(to) => setDraftFilters((f) => ({ ...f, to }))}
        />
        <fieldset className="mt-4 rounded-md border border-slate-200 p-3">
          <legend className="px-1 text-sm font-medium text-slate-700">Situação</legend>
          <div className="mt-2 flex flex-col gap-2 text-sm">
            {(
              [
                ['abertos', 'Abertos'],
                ['fechados', 'Fechados (pendente + conferido)'],
                ['pendente', 'Pendente de conferência'],
                ['conferidos', 'Conferidos'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draftFilters[key]}
                  onChange={(e) => setDraftFilters((f) => ({ ...f, [key]: e.target.checked }))}
                />
                {label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Marque &quot;Fechados&quot; para incluir sessões já encerradas pelo operador. Combine com pendente ou
            conferidos para refinar.
          </p>
        </fieldset>
      </FormCadastroModal>

      <ModuleReportsModal open={reportsOpen} title="Caixas" onClose={() => setReportsOpen(false)} compactLauncher wide>
        <CashReportLauncher />
      </ModuleReportsModal>

      <FormCadastroModal
        open={Boolean(sessionModalId)}
        onClose={closeSessionModal}
        size="xl"
        dense
        title="Registro de caixa"
        hint="Após o fechamento pelo operador, revise valores e conclua com «Conferir caixa»."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={closeSessionModal}>
              Fechar
            </Button>
            {sessionFooter && !sessionFooter.readOnly ? (
              <Button
                type="button"
                variant="secondary"
                onClick={sessionFooter.saveDraft}
                disabled={sessionFooter.saving}
              >
                Gravar observações
              </Button>
            ) : null}
            {sessionFooter?.canReconcile ? (
              <Button
                type="button"
                onClick={sessionFooter.confirmReconciliation}
                disabled={sessionFooter.saving}
              >
                Conferir caixa
              </Button>
            ) : null}
          </>
        }
      >
        {sessionModalId ? (
          <CashSessionDetail
            key={sessionModalId}
            sessionId={sessionModalId}
            embeddedInModal
            onListChanged={load}
            onFooterState={setSessionFooter}
            onAfterReconciled={closeSessionModal}
          />
        ) : null}
      </FormCadastroModal>
    </AdminShell>
  );
}

export default function VendasCaixaListPage() {
  return (
    <Suspense fallback={<AdminShell title="Caixas"><p className="p-4 text-sm text-slate-600">Carregando…</p></AdminShell>}>
      <VendasCaixaListPageInner />
    </Suspense>
  );
}
