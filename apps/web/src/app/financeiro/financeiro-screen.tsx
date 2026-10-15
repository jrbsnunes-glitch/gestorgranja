'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { ModuleSectionTabs } from '@/components/module-section-tabs';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import {
  FinanceTitlesToolbar,
  type FinancePeriodPreset,
  type FinanceStatusTab,
} from '@/components/finance/finance-titles-toolbar';
import { PayablesWorkspace } from '@/components/finance/payables-workspace';
import { ReceivablesClientWorkspace } from '@/components/finance/receivables-client-workspace';
import { rangeForFinancePeriodPreset } from '@/lib/finance-period-range';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { ExpenseTypeField } from '@/components/finance/expense-type-field';
import { PersonalBillDescription } from '@/components/agenda/personal-bill-kind';
import { PartnerLookupField } from '@/components/partner-lookup-field';
import { FinanceTitlesReportLauncher } from '@/components/finance-titles-report-launcher';
import { TitleSettlementForm } from '@/components/title-settlement-form';
import { apiFetch, downloadAuthFile, openAuthFileInNewTab } from '@/lib/api';
import type { BankBoletoDto } from '@/lib/boleto';
import { labelEnum } from '@/lib/labels';
import { formatCalendarDatePtBR, prismaDateDayKey } from '@/lib/calendar-date';
import { titleDueDayOffset, titleDueRowClass, titleDueUrgency } from '@/lib/finance-title-due';
import { formatBrl } from '@/lib/money';
import {
  dateInInclusiveRange,
  dateRangeActive,
  EMPTY_DATE_RANGE,
  type DateRangeFilter,
} from '@/lib/list-filters';

type Partner = {
  id: string;
  name: string;
  controlNumber?: number;
  cpf?: string | null;
  cnpj?: string | null;
  document?: string | null;
  phone?: string | null;
  mobile?: string | null;
};
type ChartAccountRef = { id: string; code: string; name: string };
type Payable = {
  id: string;
  controlNumber?: number;
  description: string;
  amount: string;
  amountPaid?: string;
  dueDate: string;
  approvalStatus: string;
  settlementNotes?: string | null;
  partner: Partner;
  chartAccount: ChartAccountRef;
  expenseType?: { id: string; name: string; iconKey: string } | null;
  balance?: number;
  overdueDays?: number;
  settled?: boolean;
};
type Receivable = {
  id: string;
  controlNumber?: number;
  description: string;
  amount: string;
  amountPaid?: string;
  dueDate: string;
  approvalStatus: string;
  partner: Partner;
  chartAccount: ChartAccountRef;
  balance?: number;
  overdueDays?: number;
  settled?: boolean;
  settlementNotes?: string | null;
  boletos?: BankBoletoDto[];
  salesOrder?: {
    controlNumber?: number;
    orderDate: string;
    paymentMethod?: string | null;
    paymentForm?: { kind: string; name: string } | null;
  } | null;
};

export type FinanceiroTab = 'pagar' | 'receber';

function titlePaidAmount(amount: string, amountPaid?: string) {
  return Number(amountPaid ?? 0);
}

function titleRemaining(amount: string, amountPaid?: string) {
  return Number(amount) - titlePaidAmount(amount, amountPaid);
}

function TitleScheduleFields({
  isFixed,
  onFixedChange,
}: {
  isFixed: boolean;
  onFixedChange: (v: boolean) => void;
}) {
  return (
    <>
      <label className="mb-3 flex items-center gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          checked={isFixed}
          onChange={(e) => onFixedChange(e.target.checked)}
        />
        Conta fixa — repetir todo mês no período abaixo
      </label>
      {isFixed ? (
        <div className="mb-2 space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
          <Field label="Valor mensal (R$)">
            <input name="amount" type="number" step="0.01" min={0} className={inputClass} required />
          </Field>
          <Field label="Dia do vencimento (1–28)">
            <input name="dayOfMonth" type="number" min={1} max={28} defaultValue={10} className={inputClass} required />
          </Field>
          <Field label="Início do período">
            <input name="startDate" type="date" className={inputClass} required />
          </Field>
          <Field label="Fim do período">
            <input name="endDate" type="date" className={inputClass} required />
          </Field>
          <p className="text-xs text-slate-600">
            Serão gerados títulos mensais automaticamente (até 3 meses à frente), enquanto a regra estiver ativa.
          </p>
        </div>
      ) : (
        <>
          <Field label="Valor total (R$)">
            <input name="amount" type="number" step="0.01" min={0} className={inputClass} required />
          </Field>
          <Field label="Quantidade de parcelas">
            <input name="installments" type="number" min={1} max={120} defaultValue={1} className={inputClass} required />
          </Field>
          <Field label="1º vencimento">
            <input name="dueDate" type="date" className={inputClass} required />
          </Field>
          <p className="text-xs text-slate-500">
            O valor total é dividido entre as parcelas; vencimentos mensais a partir do 1º vencimento.
          </p>
        </>
      )}
    </>
  );
}

export type FinanceListFilter = { dueDays?: number; overdueOnly?: boolean };

function matchDueFilter(dueDate: string, filter?: FinanceListFilter) {
  if (!filter?.dueDays && !filter?.overdueOnly) return true;
  const diffDays = titleDueDayOffset(dueDate);
  if (filter.overdueOnly) return diffDays < 0;
  if (filter.dueDays != null) return diffDays >= 0 && diffDays <= filter.dueDays;
  return true;
}

function matchesFinanceStatusTab(dueDate: string, settled: boolean, tab: FinanceStatusTab): boolean {
  if (tab === 'todos') return true;
  const overdue = !settled && titleDueDayOffset(dueDate) < 0;
  if (tab === 'pagos') return settled;
  if (tab === 'vencidos') return overdue;
  if (tab === 'aberto') return !settled && !overdue;
  return true;
}

function receivableListDate(r: Receivable): string {
  return prismaDateDayKey(r.salesOrder?.orderDate ?? r.dueDate);
}

function filterByAppliedDateRange<T>(
  items: T[],
  applied: DateRangeFilter,
  dayKey: (item: T) => string,
): T[] {
  if (!dateRangeActive(applied)) return items;
  return items.filter((item) => dateInInclusiveRange(dayKey(item), applied.from, applied.to));
}

export function FinanceiroScreen({
  tab,
  listFilter,
}: {
  tab: FinanceiroTab;
  listFilter?: FinanceListFilter;
}) {
  const [payables, setPayables] = useState<Payable[]>([]);
  const [receivables, setReceivables] = useState<Receivable[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [viewPayOpen, setViewPayOpen] = useState(false);
  const [viewRecOpen, setViewRecOpen] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [viewPay, setViewPay] = useState<Payable | null>(null);
  const [viewRec, setViewRec] = useState<Receivable | null>(null);
  const [settlementOpen, setSettlementOpen] = useState<'pay' | 'rec' | null>(null);
  const [statusFilter, setStatusFilter] = useState<FinanceStatusTab>('aberto');
  const [payDateDraft, setPayDateDraft] = useState(EMPTY_DATE_RANGE);
  const [payDateApplied, setPayDateApplied] = useState(EMPTY_DATE_RANGE);
  const [recDateDraft, setRecDateDraft] = useState(EMPTY_DATE_RANGE);
  const [recDateApplied, setRecDateApplied] = useState(EMPTY_DATE_RANGE);
  const [payPeriodPreset, setPayPeriodPreset] = useState<FinancePeriodPreset>('month');
  const [ddaModalOpen, setDdaModalOpen] = useState(false);
  const payDateDraftRef = useRef(payDateDraft);
  payDateDraftRef.current = payDateDraft;
  const recDateDraftRef = useRef(recDateDraft);
  recDateDraftRef.current = recDateDraft;
  const [fixedRecurring, setFixedRecurring] = useState(false);
  const [editPay, setEditPay] = useState<Payable | null>(null);
  const [editRec, setEditRec] = useState<Receivable | null>(null);

  function payableSettled(p: Payable) {
    return (
      p.settled === true ||
      p.approvalStatus === 'PAID' ||
      titleRemaining(p.amount, p.amountPaid) <= 0.004
    );
  }

  function receivableSettled(r: Receivable) {
    return (
      r.settled === true ||
      r.approvalStatus === 'PAID' ||
      titleRemaining(r.amount, r.amountPaid) <= 0.004
    );
  }

  const payFiltered = payables.filter((p) => matchDueFilter(p.dueDate, listFilter));

  const payByDate = useMemo(
    () =>
      filterByAppliedDateRange(payFiltered, payDateApplied, (p) => prismaDateDayKey(p.dueDate)),
    [payFiltered, payDateApplied],
  );

  const payStatusFilter = useCallback(
    (p: Payable) => matchesFinanceStatusTab(p.dueDate, payableSettled(p), statusFilter),
    [statusFilter],
  );

  const payList = useCrudList({
    items: payByDate,
    searchFields: (p) => [p.partner.name, p.description, p.approvalStatus, p.chartAccount.code],
    extraFilter: (p) => payStatusFilter(p),
  });
  const recVisible = receivables.filter((r) => matchDueFilter(r.dueDate, listFilter));

  const recByDate = useMemo(
    () => filterByAppliedDateRange(recVisible, recDateApplied, receivableListDate),
    [recVisible, recDateApplied],
  );

  const recStatusFilter = useCallback(
    (r: Receivable) => matchesFinanceStatusTab(r.dueDate, receivableSettled(r), statusFilter),
    [statusFilter],
  );

  const recList = useCrudList({
    items: recByDate,
    searchFields: (r) => [
      r.partner.name,
      r.description,
      r.approvalStatus,
      r.chartAccount.code,
      String(r.controlNumber ?? ''),
    ],
    extraFilter: (r) => recStatusFilter(r),
  });
  const load = useCallback(() => {
    if (tab === 'receber') {
      void apiFetch<{ items: Receivable[] }>('/v1/finance/receivables/detail').then((d) => {
        setReceivables(d.items);
      });
    } else {
      void apiFetch<{ items: Payable[] }>('/v1/finance/payables/detail').then((d) => {
        setPayables(d.items);
      });
    }
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setStatusFilter('aberto');
    if (tab === 'pagar') {
      const range = rangeForFinancePeriodPreset('month');
      if (range) {
        setPayDateDraft(range);
        setPayDateApplied(range);
        setPayPeriodPreset('month');
      }
    }
  }, [tab]);

  const applyPayPeriodPreset = useCallback((preset: FinancePeriodPreset, applyDates = true) => {
    setPayPeriodPreset(preset);
    const range = rangeForFinancePeriodPreset(preset);
    if (range && applyDates) {
      setPayDateDraft(range);
      setPayDateApplied(range);
    }
  }, []);

  const activeTitleList = tab === 'pagar' ? payList : recList;

  const applyDateFilters = useCallback(() => {
    const next = tab === 'pagar' ? payDateDraftRef.current : recDateDraftRef.current;
    const snapshot = { from: next.from, to: next.to };
    if (tab === 'pagar') {
      setPayDateApplied(snapshot);
    } else {
      setRecDateApplied(snapshot);
    }
  }, [tab]);

  const dateDraft = tab === 'pagar' ? payDateDraft : recDateDraft;
  const setDateDraft = tab === 'pagar' ? setPayDateDraft : setRecDateDraft;

  async function createPayable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const partnerId = String(fd.get('partnerId') ?? '').trim();
    const chartAccountId = String(fd.get('chartAccountId') ?? '').trim();
    if (!partnerId) {
      setError('Selecione ou cadastre o fornecedor (Pesquisar → Cadastrar novo → Salvar e usar).');
      return;
    }
    if (!chartAccountId) {
      setError('Selecione a conta contábil.');
      return;
    }
    const base = {
      partnerId,
      chartAccountId,
      expenseTypeId: String(fd.get('expenseTypeId') || '') || undefined,
      description: fd.get('description'),
      amount: Number(fd.get('amount')),
    };
    try {
      if (fixedRecurring) {
        await apiFetch('/v1/finance/recurring', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'PAYABLE',
            ...base,
            dayOfMonth: Number(fd.get('dayOfMonth')),
            startDate: fd.get('startDate'),
            endDate: fd.get('endDate'),
          }),
        });
      } else {
        await apiFetch('/v1/finance/payables', {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            dueDate: fd.get('dueDate'),
            installments: Math.max(1, Number(fd.get('installments') || 1)),
          }),
        });
      }
      setFormOpen(false);
      setFixedRecurring(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function createReceivable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const partnerId = String(fd.get('partnerId') ?? '').trim();
    const chartAccountId = String(fd.get('chartAccountId') ?? '').trim();
    if (!partnerId) {
      setError('Selecione ou cadastre o cliente (Pesquisar → Cadastrar novo → Salvar e usar).');
      return;
    }
    if (!chartAccountId) {
      setError('Selecione a conta contábil.');
      return;
    }
    const base = {
      partnerId,
      chartAccountId,
      description: fd.get('description'),
      amount: Number(fd.get('amount')),
    };
    try {
      if (fixedRecurring) {
        await apiFetch('/v1/finance/recurring', {
          method: 'POST',
          body: JSON.stringify({
            kind: 'RECEIVABLE',
            ...base,
            dayOfMonth: Number(fd.get('dayOfMonth')),
            startDate: fd.get('startDate'),
            endDate: fd.get('endDate'),
          }),
        });
      } else {
        await apiFetch('/v1/finance/receivables', {
          method: 'POST',
          body: JSON.stringify({
            ...base,
            dueDate: fd.get('dueDate'),
            installments: Math.max(1, Number(fd.get('installments') || 1)),
          }),
        });
      }
      setFormOpen(false);
      setFixedRecurring(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function approvePayable(id: string, approve: boolean) {
    await apiFetch(`/v1/finance/payables/${id}/approval`, {
      method: 'PATCH',
      body: JSON.stringify({ approve }),
    });
    load();
  }

  async function submitPayableSettlement(payload: {
    amount: number;
    settlementDate: string;
    notes: string;
    chartAccountId: string;
    expenseTypeId?: string;
  }) {
    if (!viewPay) return;
    setError(null);
    try {
      await apiFetch(`/v1/finance/payables/${viewPay.id}/pay`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSettlementOpen(null);
      setViewPayOpen(false);
      setViewPay(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitReceivableSettlement(payload: {
    amount: number;
    settlementDate: string;
    notes: string;
    chartAccountId: string;
  }) {
    if (!viewRec) return;
    setError(null);
    try {
      await apiFetch(`/v1/finance/receivables/${viewRec.id}/receive`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setSettlementOpen(null);
      setViewRecOpen(false);
      setViewRec(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  function isTitleCancelledStatus(status: string) {
    return status === 'CANCELLED';
  }

  function payableHasPayment(p: Payable) {
    return titlePaidAmount(p.amount, p.amountPaid) > 0.004 || p.approvalStatus === 'PAID';
  }

  function receivableHasPayment(r: Receivable) {
    return (
      r.settled === true ||
      titlePaidAmount(r.amount, r.amountPaid) > 0.004 ||
      r.approvalStatus === 'PAID'
    );
  }

  function payableCanEdit(p: Payable) {
    return !isTitleCancelledStatus(p.approvalStatus) && !payableHasPayment(p);
  }

  function receivableCanEdit(r: Receivable) {
    return !isTitleCancelledStatus(r.approvalStatus) && !receivableHasPayment(r);
  }

  function titleDueDateInput(iso: string) {
    return prismaDateDayKey(iso);
  }

  type TitleSituation = 'pendente' | 'pago' | 'vencido';

  function titleSituation(dueDate: string, settled: boolean): TitleSituation {
    if (settled) return 'pago';
    if (titleDueDayOffset(dueDate) < 0) return 'vencido';
    return 'pendente';
  }

  function SituationBadge({ situation }: { situation: TitleSituation }) {
    const cls =
      situation === 'pago'
        ? 'bg-emerald-100 text-emerald-800'
        : situation === 'vencido'
          ? 'bg-red-100 text-red-800'
          : 'bg-amber-100 text-amber-900';
    const label =
      situation === 'pago' ? 'Pago' : situation === 'vencido' ? 'Vencido' : 'Em aberto';
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>
    );
  }

  function dueRowClassForTitle(dueDate: string, skipHighlight = false) {
    if (skipHighlight) return '';
    return titleDueRowClass(titleDueUrgency(dueDate));
  }

  async function submitEditPayable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editPay) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const partnerId = String(fd.get('partnerId') ?? '').trim();
    const chartAccountId = String(fd.get('chartAccountId') ?? '').trim();
    if (!partnerId) {
      setError('Selecione o fornecedor.');
      return;
    }
    if (!chartAccountId) {
      setError('Selecione a conta contábil.');
      return;
    }
    try {
      await apiFetch(`/v1/finance/payables/${editPay.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          partnerId,
          chartAccountId,
          expenseTypeId: String(fd.get('expenseTypeId') || '') || null,
          description: fd.get('description'),
          amount: Number(fd.get('amount')),
          dueDate: fd.get('dueDate'),
        }),
      });
      setEditPay(null);
      if (viewPay?.id === editPay.id) {
        setViewPayOpen(false);
        setViewPay(null);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function submitEditReceivable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editRec) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    const partnerId = String(fd.get('partnerId') ?? '').trim();
    const chartAccountId = String(fd.get('chartAccountId') ?? '').trim();
    if (!partnerId) {
      setError('Selecione o cliente.');
      return;
    }
    if (!chartAccountId) {
      setError('Selecione a conta contábil.');
      return;
    }
    try {
      await apiFetch(`/v1/finance/receivables/${editRec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          partnerId,
          chartAccountId,
          description: fd.get('description'),
          amount: Number(fd.get('amount')),
          dueDate: fd.get('dueDate'),
        }),
      });
      setEditRec(null);
      if (viewRec?.id === editRec.id) {
        setViewRecOpen(false);
        setViewRec(null);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function voidPayablePayment() {
    if (!viewPay) return;
    if (!window.confirm('Estornar o pagamento informado neste título?')) return;
    setError(null);
    try {
      const updated = await apiFetch<Payable>(`/v1/finance/payables/${viewPay.id}/void-payment`, {
        method: 'POST',
      });
      setViewPay(updated);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function cancelPayableTitle() {
    if (!viewPay) return;
    if (!window.confirm('Cancelar este registro de conta a pagar?')) return;
    setError(null);
    try {
      const updated = await apiFetch<Payable>(`/v1/finance/payables/${viewPay.id}/cancel`, {
        method: 'PATCH',
      });
      setViewPay(updated);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function voidReceivablePayment() {
    if (!viewRec) return;
    if (!window.confirm('Estornar o recebimento informado neste título?')) return;
    setError(null);
    try {
      const updated = await apiFetch<Receivable>(`/v1/finance/receivables/${viewRec.id}/void-payment`, {
        method: 'POST',
      });
      setViewRec(updated);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function emitReceivableBoleto() {
    if (!viewRec) return;
    setError(null);
    try {
      const boleto = await apiFetch<BankBoletoDto>(`/v1/finance/receivables/${viewRec.id}/boleto`, {
        method: 'POST',
      });
      setViewRec({ ...viewRec, boletos: [boleto, ...(viewRec.boletos ?? [])] });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar boleto');
    }
  }

  async function downloadReceivableBoleto(boletoId: string) {
    setError(null);
    try {
      await downloadAuthFile(`/v1/finance/boletos/${boletoId}/pdf`, `boleto-${boletoId}.pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao baixar PDF');
    }
  }

  async function viewReceivableBoleto(boletoId: string) {
    setError(null);
    try {
      await openAuthFileInNewTab(`/v1/finance/boletos/${boletoId}/pdf`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao abrir boleto');
    }
  }

  async function cancelReceivableTitle() {
    if (!viewRec) return;
    if (!window.confirm('Cancelar este registro de conta a receber?')) return;
    setError(null);
    try {
      const updated = await apiFetch<Receivable>(`/v1/finance/receivables/${viewRec.id}/cancel`, {
        method: 'PATCH',
      });
      setViewRec(updated);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const reportsTitle = tab === 'pagar' ? 'Contas a pagar' : 'Contas a receber';

  const listTitle = tab === 'pagar' ? 'Contas a pagar' : 'Contas a receber';
  const novaContaLabel = tab === 'pagar' ? '+ Nova despesa' : '+ Nova conta a receber';
  const pageDescription =
    tab === 'pagar'
      ? 'Despesas da granja. Inclui compras no CNPJ e no CPF quando forem da granja.'
      : undefined;

  return (
    <AdminShell title="Financeiro">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageIntro title={listTitle} description={pageDescription} showModuleTabs={false} />
        <div className="flex flex-wrap gap-2 pt-1">
          {tab === 'pagar' ? (
            <Button type="button" variant="secondary" onClick={() => setDdaModalOpen(true)}>
              Consultar boletos DDA
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => setReportsOpen(true)}>
            Relatórios
          </Button>
          <Button
            type="button"
            onClick={() => {
              setFixedRecurring(false);
              setFormOpen(true);
              setError(null);
            }}
          >
            {novaContaLabel}
          </Button>
        </div>
      </div>
      <div className="mb-4">
        <ModuleSectionTabs />
      </div>
      <ErrorBox message={error} />

      <PageCard>
        <FinanceTitlesToolbar
          statusTab={statusFilter}
          onStatusTabChange={setStatusFilter}
          searchQuery={activeTitleList.searchQuery}
          onSearchQueryChange={activeTitleList.setSearchQuery}
          searchPlaceholder={
            tab === 'pagar' ? 'Buscar fornecedor ou descrição…' : 'Pesquisar cliente…'
          }
          dateFrom={dateDraft.from}
          dateTo={dateDraft.to}
          onDateFromChange={(v) => {
            if (tab === 'pagar') setPayPeriodPreset('custom');
            setDateDraft((d) => ({ ...d, from: v }));
          }}
          onDateToChange={(v) => {
            if (tab === 'pagar') setPayPeriodPreset('custom');
            setDateDraft((d) => ({ ...d, to: v }));
          }}
          onFilterApply={applyDateFilters}
          onRefresh={load}
          periodPreset={tab === 'pagar' ? payPeriodPreset : undefined}
          onPeriodPresetChange={
            tab === 'pagar'
              ? (preset) => {
                  applyPayPeriodPreset(preset, preset !== 'custom');
                }
              : undefined
          }
        />

        {tab === 'pagar' ? (
          <PayablesWorkspace
            payables={payList.filtered}
            ddaOpen={ddaModalOpen}
            onDdaOpenChange={setDdaModalOpen}
            onView={(p) => {
              setViewPay(p as Payable);
              setViewPayOpen(true);
            }}
            onEdit={(p) => {
              setEditPay(p as Payable);
              setError(null);
            }}
            onPay={(p) => {
              setViewPay(p as Payable);
              setSettlementOpen('pay');
            }}
            onApprove={(p) => void approvePayable(p.id, true)}
            onCancel={async (p) => {
              if (!window.confirm('Cancelar este registro de conta a pagar?')) return;
              setError(null);
              try {
                await apiFetch(`/v1/finance/payables/${p.id}/cancel`, { method: 'PATCH' });
                load();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Erro');
              }
            }}
            canEdit={(p) => payableCanEdit(p as Payable)}
            canPay={(p) =>
              (p as Payable).approvalStatus === 'APPROVED' &&
              !payableSettled(p as Payable) &&
              !isTitleCancelledStatus((p as Payable).approvalStatus)
            }
          />
        ) : (
          <ReceivablesClientWorkspace
            receivables={recList.filtered}
            onViewTitle={(r) => {
              setViewRec(r as Receivable);
              setViewRecOpen(true);
            }}
            onEditTitle={(r) => {
              setEditRec(r as Receivable);
              setError(null);
            }}
            onViewBoleto={(id) => void viewReceivableBoleto(id)}
            canEditTitle={(r) => receivableCanEdit(r as Receivable)}
            hasBoletoLink={(r) => !receivableHasPayment(r as Receivable)}
          />
        )}
      </PageCard>

      <FormCadastroModal
        open={formOpen && tab === 'pagar'}
        onClose={() => {
          setFormOpen(false);
          setFixedRecurring(false);
          setError(null);
        }}
        title="Incluir conta a pagar"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="payable-form">
              {fixedRecurring ? 'Salvar conta fixa' : 'Incluir conta a pagar'}
            </Button>
          </>
        }
      >
        <form id="payable-form" onSubmit={createPayable}>
          {error && formOpen && tab === 'pagar' ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}
          <PartnerLookupField role="supplier" name="partnerId" required label="Fornecedor / parceiro" />
          <ExpenseTypeField />
          <Field label="Conta contábil (despesa/custo)">
            <ChartAccountSelect flow="payable" required />
          </Field>
          <Field label="Descrição">
            <input name="description" className={inputClass} required />
          </Field>
          <TitleScheduleFields isFixed={fixedRecurring} onFixedChange={setFixedRecurring} />
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={formOpen && tab === 'receber'}
        onClose={() => {
          setFormOpen(false);
          setFixedRecurring(false);
          setError(null);
        }}
        title="Incluir conta a receber"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="receivable-form">
              {fixedRecurring ? 'Salvar conta fixa' : 'Incluir conta a receber'}
            </Button>
          </>
        }
      >
        <form id="receivable-form" onSubmit={createReceivable}>
          {error && formOpen && tab === 'receber' ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
          ) : null}
          <PartnerLookupField role="customer" name="partnerId" required label="Cliente / parceiro" />
          <Field label="Conta contábil (receita)">
            <ChartAccountSelect flow="receivable" required />
          </Field>
          <Field label="Descrição">
            <input name="description" className={inputClass} required />
          </Field>
          <TitleScheduleFields isFixed={fixedRecurring} onFixedChange={setFixedRecurring} />
        </form>
      </FormCadastroModal>

      <RecordViewModal
        open={viewPayOpen}
        onClose={() => setViewPayOpen(false)}
        title="Visualizar conta a pagar"
        sections={
          viewPay
            ? [
                {
                  title: 'Conta a pagar',
                  fields: [
                    { label: 'Descrição', value: viewPay.description },
                    { label: 'Parceiro', value: viewPay.partner.name },
                    {
                      label: 'Conta contábil',
                      value: `${viewPay.chartAccount.code} — ${viewPay.chartAccount.name}`,
                    },
                    { label: 'Valor', value: formatBrl(Number(viewPay.amount)) },
                    {
                      label: 'Vencimento',
                      value: formatCalendarDatePtBR(viewPay.dueDate),
                    },
                    { label: 'Status', value: labelEnum(viewPay.approvalStatus) },
                    {
                      label: 'Pago',
                      value: formatBrl(titlePaidAmount(viewPay.amount, viewPay.amountPaid)),
                    },
                    {
                      label: 'Saldo',
                      value: formatBrl(titleRemaining(viewPay.amount, viewPay.amountPaid)),
                    },
                    ...(viewPay.settlementNotes
                      ? [{ label: 'Obs. baixa', value: viewPay.settlementNotes }]
                      : []),
                  ],
                },
              ]
            : []
        }
      >
        {viewPay ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {viewPay.approvalStatus === 'PENDING' ? (
              <>
                <Button type="button" onClick={() => void approvePayable(viewPay.id, true)}>
                  Aprovar
                </Button>
                <Button type="button" variant="secondary" onClick={() => void approvePayable(viewPay.id, false)}>
                  Rejeitar
                </Button>
              </>
            ) : null}
            {viewPay.approvalStatus === 'APPROVED' &&
            !isTitleCancelledStatus(viewPay.approvalStatus) &&
            titleRemaining(viewPay.amount, viewPay.amountPaid) > 0.004 ? (
              <Button type="button" onClick={() => setSettlementOpen('pay')}>
                Registrar pagamento
              </Button>
            ) : null}
            {!isTitleCancelledStatus(viewPay.approvalStatus) && payableHasPayment(viewPay) ? (
              <Button type="button" variant="secondary" onClick={() => void voidPayablePayment()}>
                Estornar pagamento
              </Button>
            ) : null}
            {!isTitleCancelledStatus(viewPay.approvalStatus) && !payableHasPayment(viewPay) ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditPay(viewPay);
                    setError(null);
                  }}
                >
                  Alterar
                </Button>
                <Button type="button" variant="secondary" onClick={() => void cancelPayableTitle()}>
                  Cancelar título
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </RecordViewModal>

      <RecordViewModal
        open={viewRecOpen}
        onClose={() => setViewRecOpen(false)}
        title="Visualizar conta a receber"
        sections={
          viewRec
            ? [
                {
                  title: 'Conta a receber',
                  fields: [
                    { label: 'Descrição', value: viewRec.description },
                    { label: 'Parceiro', value: viewRec.partner.name },
                    {
                      label: 'Conta contábil',
                      value: `${viewRec.chartAccount.code} — ${viewRec.chartAccount.name}`,
                    },
                    { label: 'Valor', value: formatBrl(Number(viewRec.amount)) },
                    {
                      label: 'Vencimento',
                      value: formatCalendarDatePtBR(viewRec.dueDate),
                    },
                    { label: 'Status', value: labelEnum(viewRec.approvalStatus) },
                    {
                      label: 'Pago',
                      value: formatBrl(Number(viewRec.amountPaid ?? 0)),
                    },
                    {
                      label: 'Saldo',
                      value: formatBrl(viewRec.balance ?? titleRemaining(viewRec.amount, viewRec.amountPaid)),
                    },
                    ...(viewRec.settlementNotes
                      ? [{ label: 'Obs. baixa', value: viewRec.settlementNotes }]
                      : []),
                    ...(viewRec.boletos?.[0]?.linhaDigitavel
                      ? [{ label: 'Linha digitável', value: viewRec.boletos[0].linhaDigitavel }]
                      : []),
                    ...(viewRec.boletos?.[0]?.nossoNumero
                      ? [{ label: 'Nosso número', value: viewRec.boletos[0].nossoNumero }]
                      : []),
                  ],
                },
              ]
            : []
        }
      >
        {viewRec ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {!viewRec.settled && !isTitleCancelledStatus(viewRec.approvalStatus) ? (
              <Button type="button" onClick={() => setSettlementOpen('rec')}>
                Registrar recebimento
              </Button>
            ) : null}
            {!isTitleCancelledStatus(viewRec.approvalStatus) && receivableHasPayment(viewRec) ? (
              <Button type="button" variant="secondary" onClick={() => void voidReceivablePayment()}>
                Estornar recebimento
              </Button>
            ) : null}
            {viewRec.boletos?.[0]?.id && receivableHasPayment(viewRec) ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => void downloadReceivableBoleto(viewRec.boletos![0].id)}
              >
                Baixar PDF do boleto
              </Button>
            ) : null}
            {!isTitleCancelledStatus(viewRec.approvalStatus) && !receivableHasPayment(viewRec) ? (
              <>
                {viewRec.boletos?.[0]?.status === 'REGISTERED' && viewRec.boletos[0].id ? (
                  <Button type="button" onClick={() => void viewReceivableBoleto(viewRec.boletos![0].id)}>
                    Ver boleto Sicoob
                  </Button>
                ) : (
                  <Button type="button" onClick={() => void emitReceivableBoleto()}>
                    Gerar boleto Sicoob
                  </Button>
                )}
                {viewRec.boletos?.[0]?.id ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void downloadReceivableBoleto(viewRec.boletos![0].id)}
                  >
                    Baixar PDF
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setEditRec(viewRec);
                    setError(null);
                  }}
                >
                  Alterar
                </Button>
                <Button type="button" variant="secondary" onClick={() => void cancelReceivableTitle()}>
                  Cancelar título
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
      </RecordViewModal>

      <FormCadastroModal
        open={editPay != null}
        onClose={() => {
          setEditPay(null);
          setError(null);
        }}
        title="Alterar conta a pagar"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditPay(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-payable-form">
              Salvar alterações
            </Button>
          </>
        }
      >
        {editPay ? (
          <form id="edit-payable-form" key={editPay.id} onSubmit={submitEditPayable}>
            {error && editPay ? (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            ) : null}
            <PartnerLookupField
              role="supplier"
              name="partnerId"
              required
              label="Fornecedor / parceiro"
              defaultValue={editPay.partner.id}
            />
            <ExpenseTypeField defaultValue={editPay.expenseType?.id} />
            <Field label="Conta contábil (despesa/custo)">
              <ChartAccountSelect flow="payable" required defaultValue={editPay.chartAccount.id} />
            </Field>
            <Field label="Descrição">
              <input name="description" className={inputClass} required defaultValue={editPay.description} />
            </Field>
            <Field label="Valor (R$)">
              <input
                name="amount"
                type="number"
                step="0.01"
                min={0}
                className={inputClass}
                required
                defaultValue={Number(editPay.amount)}
              />
            </Field>
            <Field label="Vencimento">
              <input
                name="dueDate"
                type="date"
                className={inputClass}
                required
                defaultValue={titleDueDateInput(editPay.dueDate)}
              />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>

      <FormCadastroModal
        open={editRec != null}
        onClose={() => {
          setEditRec(null);
          setError(null);
        }}
        title="Alterar conta a receber"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditRec(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="edit-receivable-form">
              Salvar alterações
            </Button>
          </>
        }
      >
        {editRec ? (
          <form id="edit-receivable-form" key={editRec.id} onSubmit={submitEditReceivable}>
            {error && editRec ? (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
            ) : null}
            <PartnerLookupField
              role="customer"
              name="partnerId"
              required
              label="Cliente / parceiro"
              defaultValue={editRec.partner.id}
            />
            <Field label="Conta contábil (receita)">
              <ChartAccountSelect flow="receivable" required defaultValue={editRec.chartAccount.id} />
            </Field>
            <Field label="Descrição">
              <input name="description" className={inputClass} required defaultValue={editRec.description} />
            </Field>
            <Field label="Valor (R$)">
              <input
                name="amount"
                type="number"
                step="0.01"
                min={0}
                className={inputClass}
                required
                defaultValue={Number(editRec.amount)}
              />
            </Field>
            <Field label="Vencimento">
              <input
                name="dueDate"
                type="date"
                className={inputClass}
                required
                defaultValue={titleDueDateInput(editRec.dueDate)}
              />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>

      <FormCadastroModal
        open={settlementOpen === 'pay' && viewPay != null}
        onClose={() => setSettlementOpen(null)}
        title="Registrar pagamento (conta a pagar)"
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setSettlementOpen(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="pay-settlement-form">
              Confirmar pagamento
            </Button>
          </>
        }
      >
        {viewPay ? (
          <TitleSettlementForm
            key={viewPay.id}
            formId="pay-settlement-form"
            kind="payable"
            titleAmount={Number(viewPay.amount)}
            amountPaid={titlePaidAmount(viewPay.amount, viewPay.amountPaid)}
            defaultChartAccountId={viewPay.chartAccount.id}
            defaultExpenseTypeId={viewPay.expenseType?.id}
            onSubmit={(p) => void submitPayableSettlement(p)}
          />
        ) : null}
      </FormCadastroModal>

      <FormCadastroModal
        open={settlementOpen === 'rec' && viewRec != null}
        onClose={() => setSettlementOpen(null)}
        title="Receber pagamento"
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setSettlementOpen(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="rec-settlement-form">
              Confirmar recebimento
            </Button>
          </>
        }
      >
        {viewRec ? (
          <TitleSettlementForm
            key={viewRec.id}
            formId="rec-settlement-form"
            kind="receivable"
            titleAmount={Number(viewRec.amount)}
            amountPaid={titlePaidAmount(viewRec.amount, viewRec.amountPaid)}
            defaultChartAccountId={viewRec.chartAccount.id}
            partnerName={viewRec.partner.name}
            reference={viewRec.description}
            referenceDate={formatCalendarDatePtBR(viewRec.dueDate)}
            onSubmit={(p) => void submitReceivableSettlement(p)}
          />
        ) : null}
      </FormCadastroModal>

      <ModuleReportsModal
        open={reportsOpen}
        title={reportsTitle}
        onClose={() => setReportsOpen(false)}
        compactLauncher
        wide
      >
        <FinanceTitlesReportLauncher
          kind={tab === 'pagar' ? 'payable' : 'receivable'}
          reportTitle={reportsTitle}
          partners={partners}
        />
      </ModuleReportsModal>
    </AdminShell>
  );
}
