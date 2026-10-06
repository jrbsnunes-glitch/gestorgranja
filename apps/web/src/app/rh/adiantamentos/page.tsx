'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro, useCrudList } from '@/components/crud';
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
import { currentYearMonthLocal } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';

type Employee = { id: string; name: string; baseSalary: string };
type Advance = {
  id: string;
  employeeId: string;
  amount: string;
  paidAt: string;
  discountYearMonth: string;
  status: string;
  notes: string | null;
  employee: { name: string; baseSalary?: string };
};

type AdvanceWarnings = {
  salaryAdvanceMaxPct: number;
  requireSalaryAdvanceNotes: boolean;
  alerts: {
    advanceId: string;
    employeeName: string;
    discountYearMonth: string;
    amount: number;
    usedPct: number | null;
    overThreshold: boolean;
  }[];
};

function statusLabel(status: string) {
  if (status === 'PENDING') return 'Pendente (desconto na folha)';
  if (status === 'APPLIED') return 'Descontado na folha';
  if (status === 'CANCELLED') return 'Cancelado';
  return status;
}

export default function AdiantamentosPage() {
  const [rows, setRows] = useState<Advance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [warnings, setWarnings] = useState<AdvanceWarnings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Advance | null>(null);

  const list = useCrudList({
    items: rows,
    searchFields: (r) => [r.employee.name, r.discountYearMonth, r.status, r.notes ?? ''],
    dateField: (r) => r.paidAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Advance[]>('/v1/hr/salary-advances').then(setRows);
    void apiFetch<AdvanceWarnings>('/v1/hr/salary-advances/warnings').then(setWarnings);
  }, []);

  useEffect(() => {
    load();
    void apiFetch<Employee[]>('/v1/hr/employees').then(setEmployees);
  }, [load]);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const body = {
      employeeId: fd.get('employeeId'),
      amount: Number(fd.get('amount')),
      paidAt: fd.get('paidAt'),
      discountYearMonth: fd.get('discountYearMonth') || undefined,
      notes: fd.get('notes') || undefined,
    };
    try {
      if (modal === 'edit' && selected) {
        await apiFetch(`/v1/hr/salary-advances/${selected.id}`, { method: 'PATCH', body: JSON.stringify(body) });
      } else {
        await apiFetch('/v1/hr/salary-advances', { method: 'POST', body: JSON.stringify(body) });
      }
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function cancel(row: Advance) {
    if (!confirm('Cancelar este adiantamento?')) return;
    try {
      await apiFetch(`/v1/hr/salary-advances/${row.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function remove(row: Advance) {
    if (!confirm('Excluir adiantamento?')) return;
    try {
      await apiFetch(`/v1/hr/salary-advances/${row.id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminShell title="Adiantamentos salariais">
      <PageIntro
        title="Adiantamentos (vale)"
        description="Vale salarial para quem está na folha CLT (geral 101 ou temporário 106): registre o pagamento antecipado e o desconto na competência da folha (eSocial orientativo: natureza 9200). Guarde o comprovante/recibo conforme a política da empresa."
      />
      <p className="mb-4 text-sm text-slate-600">
        <strong>Não use esta tela</strong> para autônomo (RPA / comprovante de serviços prestados) ou PJ — esses pagamentos
        ficam no financeiro, fora da folha CLT. Temporário horista/diarista com cadastro CLT 106 usa o mesmo fluxo: vale aqui,
        provento do mês na folha (ponto ou dias na linha).
      </p>
      <ErrorBox message={error} />
      {warnings && warnings.alerts.some((a) => a.overThreshold) ? (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Há adiantamentos acima do teto de {warnings.salaryAdvanceMaxPct}% do salário base. Revise antes de fechar a
          folha.
        </div>
      ) : null}
      <ListToolbar
        list={list}
        onInclude={() => {
          setSelected(null);
          setModal('include');
        }}
        label="Incluir adiantamento"
        searchPlaceholder="Funcionário, competência…"
      />
      <PaginatedTable
        headers={['Funcionário', 'Pago em', 'Desconto em', 'Valor', 'Status', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.employee.name,
          r.paidAt.slice(0, 10),
          r.discountYearMonth,
          formatBrl(Number(r.amount)),
          statusLabel(r.status),
          <span key={r.id} className="flex flex-wrap gap-1">
            <RowActions
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
            />
            {r.status === 'PENDING' ? (
              <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => void cancel(r)}>
                Cancelar
              </Button>
            ) : null}
          </span>,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <Modal
        title={
          modal === 'view'
            ? 'Adiantamento'
            : modal === 'edit'
              ? 'Editar adiantamento'
              : 'Incluir adiantamento'
        }
        open={modal != null}
        onClose={() => setModal(null)}
      >
        {modal === 'view' && selected ? (
          <DetailGrid
            entries={[
              ['Funcionário', selected.employee.name],
              ['Valor', formatBrl(Number(selected.amount))],
              ['Pago em', selected.paidAt.slice(0, 10)],
              ['Competência desconto', selected.discountYearMonth],
              ['Status', statusLabel(selected.status)],
              ['Observação', selected.notes ?? '—'],
            ]}
          />
        ) : modal === 'include' || modal === 'edit' ? (
          <form onSubmit={save} className="space-y-3">
            <Field label="Funcionário">
              <select
                name="employeeId"
                className={inputClass}
                required
                defaultValue={selected?.employeeId ?? ''}
                disabled={modal === 'edit'}
              >
                <option value="">Selecione…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Valor pago (R$)">
              <input
                name="amount"
                type="number"
                step="0.01"
                min={0.01}
                className={inputClass}
                required
                defaultValue={selected ? Number(selected.amount) : undefined}
              />
            </Field>
            <Field label="Data do pagamento">
              <input
                name="paidAt"
                type="date"
                className={inputClass}
                required
                defaultValue={selected?.paidAt.slice(0, 10) ?? today}
              />
            </Field>
            <Field label="Competência do desconto (AAAA-MM)">
              <input
                name="discountYearMonth"
                className={inputClass}
                pattern="\d{4}-\d{2}"
                placeholder={currentYearMonthLocal()}
                defaultValue={selected?.discountYearMonth ?? currentYearMonthLocal()}
              />
            </Field>
            <Field label="Motivo / observação">
              <input name="notes" className={inputClass} defaultValue={selected?.notes ?? ''} />
            </Field>
            <SubmitButton label={modal === 'edit' ? 'Salvar' : 'Incluir adiantamento'} />
          </form>
        ) : null}
      </Modal>
    </AdminShell>
  );
}
