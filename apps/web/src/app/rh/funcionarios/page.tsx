'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { HrEmployeesReportLauncher } from '@/components/hr-employees-report-launcher';
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
import { ErrorBox, Field, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';

type LinkUser = { id: string; username: string; name: string; employees: { id: string; name: string }[] };
type Employee = {
  id: string;
  name: string;
  cpf: string | null;
  pisPasep: string | null;
  jobTitle: string | null;
  baseSalary: string;
  irrfDependents: number;
  hiredAt: string | null;
  bankCode: string | null;
  bankAgency: string | null;
  bankAccount: string | null;
  bankAccountDigit: string | null;
  isActive: boolean;
  userId: string | null;
  payrollWithdrawalAuthorizedAt: string | null;
  payrollWithdrawalAuthReference: string | null;
  hazardPayType: 'NONE' | 'INSALUBRIO' | 'PERICULOSIDADE';
  insalubrityPct: number;
  monthlyWorkHours: number;
  vtOptIn: boolean;
  workShiftId: string | null;
  workShift: { id: string; code: string; name: string; startTime: string; endTime: string } | null;
  user: { username: string } | null;
};

type WorkShiftOption = { id: string; code: string; name: string; isActive: boolean };

export default function FuncionariosPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [users, setUsers] = useState<LinkUser[]>([]);
  const [workShifts, setWorkShifts] = useState<WorkShiftOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Employee | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);

  const list = useCrudList({
    items: rows,
    searchFields: (e) => [e.name, e.cpf, e.jobTitle, e.user?.username],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Employee[]>('/v1/hr/employees').then(setRows);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<LinkUser[]>('/v1/hr/users-for-link').then(setUsers).catch(() => setUsers([]));
    void apiFetch<WorkShiftOption[]>('/v1/cadastros/work-shifts')
      .then((s) => setWorkShifts(s.filter((x) => x.isActive)))
      .catch(() => setWorkShifts([]));
  }, [load]);

  function open(mode: ModalMode, row?: Employee) {
    setSelected(row ?? null);
    setModal(mode);
    setError(null);
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      name: fd.get('name'),
      cpf: fd.get('cpf') || undefined,
      jobTitle: fd.get('jobTitle') || undefined,
      hiredAt: fd.get('hiredAt') || undefined,
      baseSalary: Number(fd.get('baseSalary')),
      irrfDependents: Number(fd.get('irrfDependents') ?? 0),
      pisPasep: fd.get('pisPasep') || undefined,
      bankCode: fd.get('bankCode') || undefined,
      bankAgency: fd.get('bankAgency') || undefined,
      bankAccount: fd.get('bankAccount') || undefined,
      bankAccountDigit: fd.get('bankAccountDigit') || undefined,
      userId: fd.get('userId') || undefined,
      workShiftId: fd.get('workShiftId') ? String(fd.get('workShiftId')) : null,
      payrollWithdrawalAuthorizedAt: fd.get('payrollWithdrawalAuthorizedAt') || null,
      payrollWithdrawalAuthReference: fd.get('payrollWithdrawalAuthReference') || null,
      hazardPayType: fd.get('hazardPayType') || 'NONE',
      insalubrityPct: Number(fd.get('insalubrityPct') ?? 20),
      monthlyWorkHours: Number(fd.get('monthlyWorkHours') ?? 220),
      vtOptIn: fd.get('vtOptIn') === 'on',
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/hr/employees/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/hr/employees', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function inactivate(row: Employee) {
    if (!confirm(`Inativar ${row.name}?`)) return;
    await apiFetch(`/v1/hr/employees/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: false }),
    });
    load();
  }

  async function remove(row: Employee) {
    if (!confirm(`Excluir ${row.name}?`)) return;
    try {
      await apiFetch(`/v1/hr/employees/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const formFields = (
    <>
      <Field label="Nome">
        <input name="name" className={inputClass} required defaultValue={selected?.name ?? ''} />
      </Field>
      <Field label="CPF">
        <input name="cpf" className={inputClass} defaultValue={selected?.cpf ?? ''} />
      </Field>
      <Field label="PIS/PASEP (NIT)">
        <input
          name="pisPasep"
          className={inputClass}
          placeholder="11 dígitos — eSocial / holerite"
          defaultValue={selected?.pisPasep ?? ''}
        />
      </Field>
      <Field label="Cargo">
        <input name="jobTitle" className={inputClass} defaultValue={selected?.jobTitle ?? ''} />
      </Field>
      <Field label="Data admissão">
        <input
          name="hiredAt"
          type="date"
          className={inputClass}
          defaultValue={selected?.hiredAt ? selected.hiredAt.slice(0, 10) : ''}
        />
      </Field>
      <Field label="Salário base (R$)">
        <input
          name="baseSalary"
          type="number"
          step="0.01"
          min={0}
          className={inputClass}
          required
          defaultValue={selected ? Number(selected.baseSalary) : ''}
        />
      </Field>
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        O salário base fica no cadastro do funcionário e alimenta a folha. Ajustes eventuais entram como itens na
        geração da competência.
      </p>
      <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium text-slate-800">Conta para crédito salarial (opcional)</legend>
        <p className="mb-3 text-xs text-slate-600">
          Usado no holerite quando a opção &quot;Conta bancária&quot; estiver ativa em RH → Retiradas → configurações.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Banco (código)">
            <input name="bankCode" className={inputClass} defaultValue={selected?.bankCode ?? ''} />
          </Field>
          <Field label="Agência">
            <input name="bankAgency" className={inputClass} defaultValue={selected?.bankAgency ?? ''} />
          </Field>
          <Field label="Conta">
            <input name="bankAccount" className={inputClass} defaultValue={selected?.bankAccount ?? ''} />
          </Field>
          <Field label="Dígito">
            <input name="bankAccountDigit" className={inputClass} defaultValue={selected?.bankAccountDigit ?? ''} />
          </Field>
        </div>
      </fieldset>
      <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
        <legend className="px-1 text-sm font-medium text-slate-800">Adicionais e VT (folha)</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Insalubridade / periculosidade">
            <select
              name="hazardPayType"
              className={inputClass}
              defaultValue={selected?.hazardPayType ?? 'NONE'}
            >
              <option value="NONE">Nenhum</option>
              <option value="INSALUBRIO">Insalubridade (% s/ SM)</option>
              <option value="PERICULOSIDADE">Periculosidade (30% s/ salário)</option>
            </select>
          </Field>
          <Field label="Grau insalubridade (10, 20 ou 40)">
            <input
              name="insalubrityPct"
              type="number"
              min={10}
              max={40}
              step={10}
              className={inputClass}
              defaultValue={selected?.insalubrityPct ?? 20}
            />
          </Field>
          <Field label="Horas mensais (cálculo HE)">
            <input
              name="monthlyWorkHours"
              type="number"
              min={1}
              className={inputClass}
              defaultValue={selected?.monthlyWorkHours ?? 220}
            />
          </Field>
          <Field label="Vale-transporte (6% salário)">
            <label className="flex items-center gap-2 text-sm">
              <input
                name="vtOptIn"
                type="checkbox"
                defaultChecked={selected?.vtOptIn ?? false}
              />
              Descontar VT na folha
            </label>
          </Field>
        </div>
      </fieldset>
      <Field label="Dependentes (IRRF)">
        <input
          name="irrfDependents"
          type="number"
          min={0}
          step={1}
          className={inputClass}
          defaultValue={selected?.irrfDependents ?? 0}
        />
      </Field>
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        Quantidade de dependentes legais para dedução mensal do imposto de renda na folha (R$ 189,59 por dependente,
        tabela vigente).
      </p>
      <Field label="Turno de trabalho (ponto / folha)">
        <select name="workShiftId" className={inputClass} defaultValue={selected?.workShiftId ?? ''}>
          <option value="">— Sem turno —</option>
          {workShifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
      </Field>
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        Cadastre turnos em Cadastros → Turnos. Com turno e batidas, a folha pode lançar desconto PONTO se houver horas
        abaixo do esperado.
      </p>
      <Field label="Usuário do sistema (ponto)">
        <select name="userId" className={inputClass} defaultValue={selected?.userId ?? ''}>
          <option value="">— Sem vínculo —</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.username} — {u.name}
              {u.employees[0] && u.employees[0].id !== selected?.id ? ' (ocupado)' : ''}
            </option>
          ))}
        </select>
      </Field>
      <p className="-mt-2 mb-3 text-xs text-slate-500">
        Cadastro separado do usuário (permissões), mas 1 usuário = 1 funcionário para bater ponto logado.
      </p>
      <fieldset className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <legend className="px-1 text-sm font-medium text-slate-800">Desconto em folha — retirada de produtos</legend>
        <p className="mb-3 text-xs text-slate-600">
          Registre a autorização escrita do colaborário (CLT art. 462 / Súmula 342 TST). Deixe a data em branco se ainda
          não houver termo assinado.
        </p>
        <Field label="Data da autorização">
          <input
            name="payrollWithdrawalAuthorizedAt"
            type="date"
            className={inputClass}
            defaultValue={
              selected?.payrollWithdrawalAuthorizedAt ? selected.payrollWithdrawalAuthorizedAt.slice(0, 10) : ''
            }
          />
        </Field>
        <Field label="Referência do termo (opcional)">
          <input
            name="payrollWithdrawalAuthReference"
            className={inputClass}
            placeholder="Ex.: Termo RH-2026/014, pasta digital…"
            defaultValue={selected?.payrollWithdrawalAuthReference ?? ''}
          />
        </Field>
      </fieldset>
    </>
  );

  return (
    <AdminShell title="Funcionários">
      <PageIntro
        title="Funcionários"
        description="Colaboradores, turno, salário base e usuário para batida de ponto (QR na portaria)."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => open('include')}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Nome, CPF, cargo, usuário…"
      />
      <PaginatedTable
        headers={['Nome', 'CPF', 'Cargo', 'Salário', 'Aut. retirada', 'Usuário', 'Ativo', 'Ações']}
        recordItems={slice}
        rows={slice.map((e) => [
          e.name,
          e.cpf ?? '—',
          e.jobTitle ?? '—',
          `R$ ${Number(e.baseSalary).toFixed(2)}`,
          e.payrollWithdrawalAuthorizedAt
            ? formatCalendarDatePtBR(e.payrollWithdrawalAuthorizedAt)
            : 'Pendente',
          e.user?.username ?? '—',
          e.isActive ? 'Sim' : 'Não',
          <RowActions
            key={e.id}
            onView={() => open('view', e)}
            onEdit={() => open('edit', e)}
            onInactivate={e.isActive ? () => void inactivate(e) : undefined}
            onDelete={() => void remove(e)}
          />,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <Modal
        title={
          modal === 'view' ? 'Visualizar' : modal === 'edit' ? 'Editar funcionário' : 'Incluir funcionário'
        }
        open={modal !== null}
        onClose={() => setModal(null)}
        wide
      >
        {modal === 'view' && selected ? (
          <DetailGrid
            entries={[
              ['Nome', selected.name],
              ['CPF', selected.cpf ?? '—'],
              ['Cargo', selected.jobTitle ?? '—'],
              ['Salário base', `R$ ${Number(selected.baseSalary).toFixed(2)}`],
              ['Dependentes (IRRF)', String(selected.irrfDependents ?? 0)],
              ['Admissão', selected.hiredAt ? formatCalendarDatePtBR(selected.hiredAt) : '—'],
              [
                'Turno',
                selected.workShift
                  ? `${selected.workShift.code} — ${selected.workShift.name} (${selected.workShift.startTime}–${selected.workShift.endTime})`
                  : '—',
              ],
              ['Usuário', selected.user?.username ?? '—'],
              [
                'Autorização retirada/folha',
                selected.payrollWithdrawalAuthorizedAt
                  ? formatCalendarDatePtBR(selected.payrollWithdrawalAuthorizedAt)
                  : 'Não registrada',
              ],
              ['Referência do termo', selected.payrollWithdrawalAuthReference ?? '—'],
              ['Ativo', selected.isActive ? 'Sim' : 'Não'],
            ]}
          />
        ) : modal === 'include' || modal === 'edit' ? (
          <form onSubmit={save}>
            {formFields}
            <SubmitButton label={modal === 'edit' ? 'Salvar' : 'Cadastrar'} />
          </form>
        ) : null}
      </Modal>

      <ModuleReportsModal
        open={reportsOpen}
        title="Funcionários"
        onClose={() => setReportsOpen(false)}
        compactLauncher
        wide
      >
        <HrEmployeesReportLauncher returnHref="/rh/funcionarios" />
      </ModuleReportsModal>
    </AdminShell>
  );
}
