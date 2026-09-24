'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import {
  DetailGrid,
  ListToolbar,
  Modal,
  PaginatedTable,
  RowActions,
  usePagination,
  type ModalMode,
} from '@/components/list-crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR, yearMonthFromIso } from '@/lib/calendar-date';

type Employee = {
  id: string;
  name: string;
  baseSalary: string;
  payrollWithdrawalAuthorizedAt: string | null;
};
type Product = { id: string; sku: string; name: string };
type Withdrawal = {
  id: string;
  employeeId: string;
  productId: string;
  quantity: string;
  unitPrice: string;
  totalAmount: string;
  withdrawnAt: string;
  status: string;
  notes: string | null;
  employee: {
    name: string;
    baseSalary?: string;
    payrollWithdrawalAuthorizedAt?: string | null;
  };
  product: { sku: string; name: string };
};

type PayslipFieldsConfig = {
  showCompanyAddressOnSlip: boolean;
  showPis: boolean;
  showInternalId: boolean;
  showAdmissionDate: boolean;
  showIrrfDependents: boolean;
  showBankPayment: boolean;
  showPaymentDate: boolean;
  showWorkDaysReference: boolean;
};

type HrSettings = {
  productWithdrawalWarnPct: string;
  requireWithdrawalPayrollAuth: boolean;
  detailWithdrawalsOnPayslip: boolean;
  payslipFields: PayslipFieldsConfig;
};

type WithdrawalAlert = {
  employeeId: string;
  employeeName: string;
  yearMonth: string;
  pendingTotal: number;
  baseSalary: number;
  usedPct: number | null;
  overThreshold: boolean;
  missingAuth: boolean;
};

type WithdrawalWarningsPayload = {
  productWithdrawalWarnPct: number;
  requireWithdrawalPayrollAuth: boolean;
  alerts: WithdrawalAlert[];
};

function statusLabel(status: string, competencia: string) {
  if (status === 'PENDING') return `Pendente (folha ${competencia})`;
  if (status === 'APPLIED') return 'Aplicado na folha';
  if (status === 'CANCELLED') return 'Cancelado';
  return status;
}

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export default function RetiradasPage() {
  const [rows, setRows] = useState<Withdrawal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<HrSettings | null>(null);
  const [warnings, setWarnings] = useState<WithdrawalWarningsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Withdrawal | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [settingsDraftPct, setSettingsDraftPct] = useState('70');
  const [settingsDraftRequireAuth, setSettingsDraftRequireAuth] = useState(true);
  const [settingsDraftDetailPayslip, setSettingsDraftDetailPayslip] = useState(true);
  const [settingsDraftPayslipFields, setSettingsDraftPayslipFields] = useState<PayslipFieldsConfig>({
    showCompanyAddressOnSlip: true,
    showPis: true,
    showInternalId: true,
    showAdmissionDate: false,
    showIrrfDependents: true,
    showBankPayment: false,
    showPaymentDate: false,
    showWorkDaysReference: false,
  });

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [
      r.employee.name,
      r.product.sku,
      r.product.name,
      r.status,
      r.notes,
      yearMonthFromIso(r.withdrawnAt),
    ],
    dateField: (r) => r.withdrawnAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Withdrawal[]>('/v1/hr/withdrawals').then(setRows);
    void apiFetch<WithdrawalWarningsPayload>('/v1/hr/withdrawals/warnings').then(setWarnings);
  }, []);

  const loadSettings = useCallback(() => {
    void apiFetch<HrSettings>('/v1/hr/settings').then((s) => {
      setSettings(s);
      setSettingsDraftPct(String(Number(s.productWithdrawalWarnPct)));
      setSettingsDraftRequireAuth(s.requireWithdrawalPayrollAuth);
      setSettingsDraftDetailPayslip(s.detailWithdrawalsOnPayslip);
      if (s.payslipFields) setSettingsDraftPayslipFields(s.payslipFields);
    });
  }, []);

  function togglePayslipField(key: keyof PayslipFieldsConfig) {
    setSettingsDraftPayslipFields((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  useEffect(() => {
    load();
    loadSettings();
    void apiFetch<Employee[]>('/v1/hr/employees').then(setEmployees);
    void apiFetch<Product[]>('/v1/inventory/products').then(setProducts);
  }, [load, loadSettings]);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch('/v1/hr/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          productWithdrawalWarnPct: Number(settingsDraftPct),
          requireWithdrawalPayrollAuth: settingsDraftRequireAuth,
          detailWithdrawalsOnPayslip: settingsDraftDetailPayslip,
          payslipFields: settingsDraftPayslipFields,
        }),
      });
      loadSettings();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar configurações');
    }
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      employeeId: fd.get('employeeId'),
      productId: fd.get('productId'),
      quantity: Number(fd.get('quantity')),
      unitPrice: Number(fd.get('unitPrice')),
      notes: fd.get('notes') || undefined,
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/hr/withdrawals/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        const res = await apiFetch<{ withdrawal: Withdrawal; warnings: string[] }>('/v1/hr/withdrawals', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (res.warnings?.length) {
          setNotice(res.warnings.join(' '));
        }
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function remove(row: Withdrawal) {
    if (!confirm('Excluir retirada?')) return;
    try {
      await apiFetch(`/v1/hr/withdrawals/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Retiradas de produtos (desconto em folha)">
      <PageIntro
        title="Retiradas de produtos"
        description="Registre a retirada física e o valor a descontar na folha da competência. Exige autorização escrita no cadastro do funcionário quando configurado abaixo."
      />
      <ErrorBox message={error} />
      {notice ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {notice}
        </div>
      ) : null}
      <PageCard title="Regras de desconto em folha">
        <form onSubmit={saveSettings} className="grid max-w-2xl gap-3 sm:grid-cols-2">
          <Field label="Aviso a partir de (% do salário base)">
            <input
              type="number"
              min={1}
              max={100}
              step={1}
              className={inputClass}
              value={settingsDraftPct}
              onChange={(e) => setSettingsDraftPct(e.target.value)}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={settingsDraftRequireAuth}
              onChange={(e) => setSettingsDraftRequireAuth(e.target.checked)}
            />
            Bloquear retirada sem autorização no cadastro
          </label>
          <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={settingsDraftDetailPayslip}
              onChange={(e) => setSettingsDraftDetailPayslip(e.target.checked)}
            />
            <span>
              Holerite: uma linha de desconto por retirada (produto/SKU)
              {!settingsDraftDetailPayslip ? (
                <span className="mt-1 block text-xs text-amber-800">
                  Desmarcado: o holerite mostra uma linha consolidada e imprime o detalhamento das retiradas em anexo
                  no mesmo demonstrativo (conferência e arquivo). A folha interna continua com cada RET_PROD separado.
                </span>
              ) : null}
            </span>
          </label>
          <fieldset className="sm:col-span-2 rounded-md border border-slate-200 bg-white p-3">
            <legend className="px-1 text-sm font-medium text-slate-800">Demonstrativo (holerite)</legend>
            <p className="mb-2 text-xs text-slate-600">
              Bases INSS/IRRF/FGTS sempre aparecem no holerite. Marque os campos extras a exibir.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ['showCompanyAddressOnSlip', 'Endereço do empregador em cada holerite'],
                  ['showPis', 'PIS/PASEP'],
                  ['showInternalId', 'Matrícula (nº controle)'],
                  ['showAdmissionDate', 'Data de admissão'],
                  ['showIrrfDependents', 'Quantidade de dependentes (IRRF)'],
                  ['showBankPayment', 'Conta bancária para crédito'],
                  ['showPaymentDate', 'Data de pagamento da competência'],
                  ['showWorkDaysReference', 'Dias no mês (referência)'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={settingsDraftPayslipFields[key]}
                    onChange={() => togglePayslipField(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <Button type="submit" variant="secondary">
              Salvar regras
            </Button>
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-500">
          Referência jurisprudencial: OJ 18 SDC/TST (até 70% do salário-base em descontos autorizados). O percentual
          aqui é só para alerta operacional, não substitui orientação jurídica.
        </p>
      </PageCard>
      {warnings && warnings.alerts.length > 0 ? (
        <PageCard title="Alertas — retiradas pendentes">
          <ul className="space-y-2 text-sm">
            {warnings.alerts.map((a) => (
              <li key={`${a.employeeId}-${a.yearMonth}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                <span className="font-medium text-slate-900">{a.employeeName}</span>
                <span className="text-slate-600"> — competência {a.yearMonth}: </span>
                <span className="tabular-nums">{money(a.pendingTotal)}</span>
                {a.usedPct != null ? <span className="text-slate-600"> ({a.usedPct}% do salário base)</span> : null}
                {a.missingAuth ? (
                  <span className="ml-2 font-medium text-red-700">Sem autorização no cadastro</span>
                ) : null}
                {a.overThreshold ? (
                  <span className="ml-2 font-medium text-amber-800">Acima do limite de aviso ({warnings.productWithdrawalWarnPct}%)</span>
                ) : null}
              </li>
            ))}
          </ul>
        </PageCard>
      ) : null}
      <ListToolbar
        list={list}
        onInclude={() => {
          setSelected(null);
          setModal('include');
        }}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Funcionário, produto, competência…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Data', 'Competência', 'Funcionário', 'Produto', 'Qtd', 'Total', 'Status', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => {
          const competencia = yearMonthFromIso(r.withdrawnAt);
          return [
            new Date(r.withdrawnAt).toLocaleString('pt-BR'),
            competencia,
            r.employee.name,
            `${r.product.sku}`,
            String(r.quantity),
            `R$ ${Number(r.totalAmount).toFixed(2)}`,
            statusLabel(r.status, competencia),
            <RowActions
              key={r.id}
              onView={() => {
                setSelected(r);
                setModal('view');
              }}
              onEdit={
                r.status === 'PENDING'
                  ? () => {
                      setSelected(r);
                      setModal('edit');
                    }
                  : undefined
              }
              onDelete={r.status === 'PENDING' ? () => void remove(r) : undefined}
            />,
          ];
        })}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <Modal
        title={
          modal === 'view' ? 'Visualizar retirada' : modal === 'edit' ? 'Editar retirada' : 'Nova retirada'
        }
        open={modal !== null}
        onClose={() => setModal(null)}
      >
        {modal === 'view' && selected ? (
          <DetailGrid
            entries={[
              ['Data', new Date(selected.withdrawnAt).toLocaleString('pt-BR')],
              ['Competência (folha)', yearMonthFromIso(selected.withdrawnAt)],
              ['Funcionário', selected.employee.name],
              [
                'Autorização folha',
                selected.employee.payrollWithdrawalAuthorizedAt
                  ? formatCalendarDatePtBR(selected.employee.payrollWithdrawalAuthorizedAt)
                  : 'Não registrada',
              ],
              ['Produto', `${selected.product.sku} — ${selected.product.name}`],
              ['Quantidade', String(selected.quantity)],
              ['Preço unitário', `R$ ${Number(selected.unitPrice).toFixed(2)}`],
              ['Total', `R$ ${Number(selected.totalAmount).toFixed(2)}`],
              ['Status', statusLabel(selected.status, yearMonthFromIso(selected.withdrawnAt))],
              ['Observação', selected.notes ?? '—'],
            ]}
          />
        ) : modal === 'include' || modal === 'edit' ? (
          <form onSubmit={save} key={selected?.id ?? 'new'}>
            <Field label="Funcionário">
              <select
                name="employeeId"
                className={inputClass}
                required
                defaultValue={selected?.employeeId ?? employees[0]?.id ?? ''}
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.payrollWithdrawalAuthorizedAt ? '' : ' — sem autorização folha'}
                  </option>
                ))}
              </select>
            </Field>
            {settings?.requireWithdrawalPayrollAuth ? (
              <p className="-mt-2 mb-3 text-xs text-slate-500">
                Retiradas só são permitidas para funcionários com data de autorização em Funcionários → cadastro.
              </p>
            ) : null}
            <Field label="Produto">
              <select
                name="productId"
                className={inputClass}
                required
                defaultValue={selected?.productId ?? products[0]?.id ?? ''}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} — {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Quantidade">
              <input
                name="quantity"
                type="number"
                step="0.001"
                min={0}
                className={inputClass}
                required
                defaultValue={selected ? Number(selected.quantity) : ''}
              />
            </Field>
            <Field label="Preço unit. (R$)">
              <input
                name="unitPrice"
                type="number"
                step="0.01"
                min={0}
                className={inputClass}
                required
                defaultValue={selected ? Number(selected.unitPrice) : ''}
              />
            </Field>
            <Field label="Obs.">
              <input name="notes" className={inputClass} defaultValue={selected?.notes ?? ''} />
            </Field>
            <SubmitButton label="Salvar" />
          </form>
        ) : null}
      </Modal>

      <ModuleReportsModal open={reportsOpen} title="Retiradas" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
