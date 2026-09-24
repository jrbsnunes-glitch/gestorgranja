'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import {
  FormCadastroModal,
  ModuleReportsModal,
  PageIntro,
  RecordViewModal,
  useCrudList,
} from '@/components/crud';
import { ListToolbar, PaginatedTable, RowActions, usePagination } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { FinanceTitlesReportLauncher } from '@/components/finance-titles-report-launcher';
import { TitleSettlementForm } from '@/components/title-settlement-form';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';

type Partner = { id: string; name: string };
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
};

type Concentration = {
  partnerName: string;
  openBalance: number;
  sharePct: number;
};

export type FinanceiroTab = 'pagar' | 'receber';

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

export function FinanceiroScreen({ tab }: { tab: FinanceiroTab }) {
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
  const [concentration, setConcentration] = useState<Concentration[]>([]);
  const [settlementOpen, setSettlementOpen] = useState<'pay' | 'rec' | null>(null);
  const [fixedRecurring, setFixedRecurring] = useState(false);

  const payList = useCrudList({
    items: payables,
    searchFields: (p) => [p.description, p.partner.name, p.approvalStatus, p.chartAccount.code],
  });
  const payPag = usePagination(payList.filtered);

  const recOpenOnly = receivables.filter((r) => !r.settled);
  const recList = useCrudList({
    items: recOpenOnly,
    searchFields: (r) => [
      r.description,
      r.partner.name,
      r.approvalStatus,
      r.chartAccount.code,
      String(r.controlNumber ?? ''),
    ],
  });
  const recPag = usePagination(recList.filtered);

  const load = useCallback(() => {
    if (tab === 'receber') {
      void apiFetch<{ items: Receivable[]; concentration: Concentration[] }>('/v1/finance/receivables/detail').then(
        (d) => {
          setReceivables(d.items);
          setConcentration(d.concentration);
        },
      );
    } else {
      void apiFetch<{ payables: Payable[]; receivables: Receivable[] }>('/v1/finance/open').then((d) => {
        setPayables(d.payables);
      });
    }
    void apiFetch<Partner[]>('/v1/cadastros/partners').then(setPartners);
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function createPayable(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const base = {
      partnerId: fd.get('partnerId'),
      chartAccountId: fd.get('chartAccountId'),
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
    const base = {
      partnerId: fd.get('partnerId'),
      chartAccountId: fd.get('chartAccountId'),
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

  function titlePaidAmount(amount: string, amountPaid?: string) {
    return Number(amountPaid ?? 0);
  }

  function titleRemaining(amount: string, amountPaid?: string) {
    return Number(amount) - titlePaidAmount(amount, amountPaid);
  }

  const reportsTitle = tab === 'pagar' ? 'Contas a pagar' : 'Contas a receber';

  return (
    <AdminShell title="Financeiro">
      <PageIntro
        title="Financeiro"
        description="Inclusão com parcelas ou conta fixa mensal; aprovação e baixa nos títulos em aberto."
      />
      <ErrorBox message={error} />

      {tab === 'pagar' ? (
        <PageCard title="Contas a pagar em aberto">
          <ListToolbar
            list={payList}
            onInclude={() => {
              setFixedRecurring(false);
              setFormOpen(true);
              setError(null);
            }}
            onReports={() => setReportsOpen(true)}
            showPrint={false}
            searchPlaceholder="Descrição, parceiro, status…"
          />
          <PaginatedTable
            headers={['Descrição', 'Parceiro', 'Valor', 'Venc.', 'Status', 'Aprovar', 'Ações']}
            recordItems={payPag.slice}
            rows={payPag.slice.map((p) => [
              p.description,
              p.partner.name,
              `R$ ${Number(p.amount).toFixed(2)}`,
              new Date(p.dueDate).toLocaleDateString('pt-BR'),
              labelEnum(p.approvalStatus),
              p.approvalStatus === 'PENDING' ? (
                <Button
                  key={`ap-${p.id}`}
                  type="button"
                  className="px-2 py-1 text-xs"
                  onClick={() => void approvePayable(p.id, true)}
                >
                  Aprovar
                </Button>
              ) : (
                '—'
              ),
              <RowActions
                key={p.id}
                onView={() => {
                  setViewPay(p);
                  setViewPayOpen(true);
                }}
              />,
            ])}
            page={payPag.page}
            totalPages={payPag.totalPages}
            total={payPag.total}
            onPage={payPag.setPage}
          />
        </PageCard>
      ) : (
        <>
          {concentration.length > 0 ? (
            <PageCard title="Concentração — top clientes">
              <ul className="space-y-1 text-sm">
                {concentration.slice(0, 3).map((c) => (
                  <li key={c.partnerName} className="flex justify-between">
                    <span>{c.partnerName}</span>
                    <span className="tabular-nums">
                      R$ {c.openBalance.toFixed(2)} ({c.sharePct.toFixed(1)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </PageCard>
          ) : null}
          <PageCard title="Contas a receber">
            <ListToolbar
              list={recList}
              onInclude={() => {
                setFixedRecurring(false);
                setFormOpen(true);
                setError(null);
              }}
              onReports={() => setReportsOpen(true)}
              showPrint={false}
              searchPlaceholder="Controle, descrição, parceiro…"
            />
            <PaginatedTable
              headers={['Descrição', 'Parceiro', 'Venc.', 'Atraso', 'Saldo', 'Ações']}
              recordItems={recPag.slice}
              rows={recPag.slice.map((r) => [
                r.description,
                r.partner.name,
                new Date(r.dueDate).toLocaleDateString('pt-BR'),
                r.overdueDays && r.overdueDays > 0 ? `${r.overdueDays}d` : '—',
                `R$ ${(r.balance ?? Number(r.amount)).toFixed(2)}`,
                <RowActions
                  key={r.id}
                  onView={() => {
                    setViewRec(r);
                    setViewRecOpen(true);
                  }}
                />,
              ])}
              page={recPag.page}
              totalPages={recPag.totalPages}
              total={recPag.total}
              onPage={recPag.setPage}
            />
          </PageCard>
        </>
      )}

      <FormCadastroModal
        open={formOpen && tab === 'pagar'}
        onClose={() => {
          setFormOpen(false);
          setFixedRecurring(false);
        }}
        title="Incluir conta a pagar"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="payable-form">
              {fixedRecurring ? 'Salvar conta fixa' : 'Incluir CP'}
            </Button>
          </>
        }
      >
        <form id="payable-form" onSubmit={createPayable}>
          <Field label="Parceiro">
            <select name="partnerId" className={inputClass} required>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
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
        }}
        title="Incluir conta a receber"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="receivable-form">
              {fixedRecurring ? 'Salvar conta fixa' : 'Incluir CR'}
            </Button>
          </>
        }
      >
        <form id="receivable-form" onSubmit={createReceivable}>
          <Field label="Parceiro">
            <select name="partnerId" className={inputClass} required>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
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
        title="Visualizar CP"
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
                    { label: 'Valor', value: `R$ ${Number(viewPay.amount).toFixed(2)}` },
                    {
                      label: 'Vencimento',
                      value: new Date(viewPay.dueDate).toLocaleDateString('pt-BR'),
                    },
                    { label: 'Status', value: labelEnum(viewPay.approvalStatus) },
                    {
                      label: 'Pago',
                      value: `R$ ${titlePaidAmount(viewPay.amount, viewPay.amountPaid).toFixed(2)}`,
                    },
                    {
                      label: 'Saldo',
                      value: `R$ ${titleRemaining(viewPay.amount, viewPay.amountPaid).toFixed(2)}`,
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
            {viewPay.approvalStatus === 'APPROVED' && titleRemaining(viewPay.amount, viewPay.amountPaid) > 0.004 ? (
              <Button type="button" onClick={() => setSettlementOpen('pay')}>
                Registrar pagamento
              </Button>
            ) : null}
          </div>
        ) : null}
      </RecordViewModal>

      <RecordViewModal
        open={viewRecOpen}
        onClose={() => setViewRecOpen(false)}
        title="Visualizar CR"
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
                    { label: 'Valor', value: `R$ ${Number(viewRec.amount).toFixed(2)}` },
                    {
                      label: 'Vencimento',
                      value: new Date(viewRec.dueDate).toLocaleDateString('pt-BR'),
                    },
                    { label: 'Status', value: labelEnum(viewRec.approvalStatus) },
                    {
                      label: 'Pago',
                      value: `R$ ${Number(viewRec.amountPaid ?? 0).toFixed(2)}`,
                    },
                    {
                      label: 'Saldo',
                      value: `R$ ${(viewRec.balance ?? titleRemaining(viewRec.amount, viewRec.amountPaid)).toFixed(2)}`,
                    },
                    ...(viewRec.settlementNotes
                      ? [{ label: 'Obs. baixa', value: viewRec.settlementNotes }]
                      : []),
                  ],
                },
              ]
            : []
        }
      >
        {viewRec && !viewRec.settled ? (
          <div className="mt-4">
            <Button type="button" onClick={() => setSettlementOpen('rec')}>
              Registrar recebimento
            </Button>
          </div>
        ) : null}
      </RecordViewModal>

      <FormCadastroModal
        open={settlementOpen === 'pay' && viewPay != null}
        onClose={() => setSettlementOpen(null)}
        title="Registrar pagamento (CP)"
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
            onSubmit={(p) => void submitPayableSettlement(p)}
          />
        ) : null}
      </FormCadastroModal>

      <FormCadastroModal
        open={settlementOpen === 'rec' && viewRec != null}
        onClose={() => setSettlementOpen(null)}
        title="Registrar recebimento (CR)"
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
