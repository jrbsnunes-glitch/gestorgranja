'use client';

import { FormEvent, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PayrollViewButton } from '@/components/payroll-view-button';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { ListToolbar, Modal, PaginatedTable, usePagination, type ModalMode } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import { currentYearMonthLocal } from '@/lib/calendar-date';

type PayrollLineItem = {
  kind: string;
  code: string;
  description: string;
  amount: string;
};

type PayrollLine = {
  id: string;
  baseSalary: string;
  payrollBaseDisplay: string | null;
  otHours50: string;
  otHours100: string;
  commissionAmount: string;
  ajudaCustoAmount: string;
  additions: string;
  deductions: string;
  netPay: string;
  employee: { name: string };
  items: PayrollLineItem[];
};

type PayrollRun = {
  id: string;
  yearMonth: string;
  status: string;
  paymentDate: string | null;
  lines: PayrollLine[];
};

function FolhaPageContent() {
  const searchParams = useSearchParams();
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selected, setSelected] = useState<PayrollRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalMode>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [editLine, setEditLine] = useState<PayrollLine | null>(null);

  const list = useCrudList({
    items: runs,
    searchFields: (r) => [r.yearMonth, r.status],
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    setError(null);
    void apiFetch<PayrollRun[]>('/v1/hr/payroll')
      .then((data) => {
        setRuns(data);
        setSelected((prev) => (prev ? data.find((r) => r.id === prev.id) ?? prev : prev));
      })
      .catch((err) => {
        setRuns([]);
        let message = err instanceof Error ? err.message : 'Erro ao carregar folhas';
        try {
          const parsed = JSON.parse(message) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          /* texto bruto da API */
        }
        if (message.includes('Internal server error') || message.includes('500')) {
          message =
            'Não foi possível carregar as folhas (erro no servidor). Se acabou de atualizar o sistema, aplique as migrações do banco do tenant.';
        }
        setError(message);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const runId = searchParams.get('run');
    if (!runId || !runs.length) return;
    const match = runs.find((r) => r.id === runId);
    if (match) setSelected(match);
  }, [runs, searchParams]);

  async function createRun(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/hr/payroll', {
        method: 'POST',
        body: JSON.stringify({ yearMonth: fd.get('yearMonth') }),
      });
      setModal(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function closeRun(id: string) {
    setError(null);
    try {
      await apiFetch(`/v1/hr/payroll/${id}/close`, { method: 'PATCH', body: '{}' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fechar');
    }
  }

  async function applyWithdrawals(id: string) {
    setError(null);
    try {
      const updated = await apiFetch<PayrollRun>(`/v1/hr/payroll/${id}/apply-withdrawals`, {
        method: 'POST',
        body: '{}',
      });
      load();
      if (selected?.id === id) setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao aplicar retiradas');
    }
  }

  async function savePaymentDate(runId: string, paymentDate: string) {
    setError(null);
    try {
      const updated = await apiFetch<PayrollRun>(`/v1/hr/payroll/${runId}`, {
        method: 'PATCH',
        body: JSON.stringify({ paymentDate: paymentDate || null }),
      });
      load();
      if (selected?.id === runId) setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar data de pagamento');
    }
  }

  async function saveLineVars(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editLine || selected?.status === 'CLOSED') return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/v1/hr/payroll/lines/${editLine.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          otHours50: Number(fd.get('otHours50') ?? 0),
          otHours100: Number(fd.get('otHours100') ?? 0),
          commissionAmount: Number(fd.get('commissionAmount') ?? 0),
          ajudaCustoAmount: Number(fd.get('ajudaCustoAmount') ?? 0),
          recalculate: true,
        }),
      });
      setEditLine(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao recalcular linha');
    }
  }

  async function syncTaxes(id: string) {
    setError(null);
    try {
      const updated = await apiFetch<PayrollRun>(`/v1/hr/payroll/${id}/sync-taxes`, {
        method: 'POST',
        body: '{}',
      });
      load();
      if (selected?.id === id) setSelected(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar INSS/IRRF');
    }
  }

  const lines = selected?.lines ?? [];

  return (
    <AdminShell title="Folha de pagamento">
      <PageIntro
        title="Folha de pagamento"
        description="Geração por competência com férias, INSS, IRRF, atestados, retiradas e ponto. Líquido = base + adicionais − descontos. Retiradas pendentes entram ao fechar a folha da mesma competência. Na impressão, INSS/IRRF são recalculados pela tabela da competência (pode diferir do líquido armazenado se a folha foi editada manualmente)."
      />
      <ErrorBox message={error} />
      <ListToolbar
        list={list}
        onInclude={() => setModal('include')}
        onReports={() => setReportsOpen(true)}
        label="Gerar folha"
        searchPlaceholder="Competência, status…"
      />
      <PaginatedTable
        headers={['Competência', 'Status', 'Linhas', 'Ações']}
        recordItems={slice}
        rows={slice.map((r) => [
          r.yearMonth,
          labelEnum(r.status),
          String(r.lines.length),
          <span key={r.id} className="flex flex-wrap gap-1">
            <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setSelected(r)}>
              Ver linhas
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => void syncTaxes(r.id)}
            >
              Atualizar INSS/IRRF
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-2 py-1 text-xs"
              onClick={() => void applyWithdrawals(r.id)}
            >
              Aplicar retiradas
            </Button>
            {r.status !== 'CLOSED' ? (
              <Button type="button" className="px-2 py-1 text-xs" onClick={() => void closeRun(r.id)}>
                Fechar
              </Button>
            ) : null}
          </span>,
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      {selected ? (
        <div className="mt-6">
        <PageCard title={`Linhas — ${selected.yearMonth}`}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <Field label="Data de pagamento (holerite)">
              <input
                type="date"
                className={inputClass}
                defaultValue={selected.paymentDate?.slice(0, 10) ?? ''}
                onBlur={(e) => void savePaymentDate(selected.id, e.target.value)}
              />
            </Field>
            <PayrollViewButton runId={selected.id} yearMonth={selected.yearMonth} />
          </div>
          <PaginatedTable
            headers={['Funcionário', 'Base', 'Adic.', 'Desc.', 'Líquido', 'Detalhe']}
            recordItems={lines}
            rows={lines.map((l) => [
              l.employee.name,
              `R$ ${Number(l.payrollBaseDisplay ?? l.baseSalary).toFixed(2)}`,
              `R$ ${Number(l.additions).toFixed(2)}`,
              `R$ ${Number(l.deductions).toFixed(2)}`,
              `R$ ${Number(l.netPay).toFixed(2)}`,
              <span key={l.id} className="max-w-xs text-xs text-slate-600">
                {selected?.status !== 'CLOSED' ? (
                  <Button
                    type="button"
                    variant="secondary"
                    className="mb-1 px-2 py-0.5 text-xs"
                    onClick={() => setEditLine(l)}
                  >
                    HE / comissão / ajuda
                  </Button>
                ) : null}
                {l.items.length ? (
                  <ul>
                    {l.items.map((i, idx) => (
                      <li key={idx}>
                        {i.description}: R$ {Number(i.amount).toFixed(2)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  '—'
                )}
              </span>,
            ])}
            page={0}
            totalPages={1}
            total={lines.length}
            onPage={() => {}}
          />
        </PageCard>
        </div>
      ) : null}

      <Modal
        title={editLine ? `Variáveis — ${editLine.employee.name}` : ''}
        open={editLine != null}
        onClose={() => setEditLine(null)}
      >
        {editLine ? (
          <form onSubmit={saveLineVars}>
            <p className="mb-3 text-xs text-slate-600">
              Insalub./peric./VT vêm do cadastro do funcionário. Ao salvar, a linha é recalculada (INSS/IRRF/DSR).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Horas extras 50%">
                <input
                  name="otHours50"
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  defaultValue={Number(editLine.otHours50 ?? 0)}
                />
              </Field>
              <Field label="Horas extras 100%">
                <input
                  name="otHours100"
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  defaultValue={Number(editLine.otHours100 ?? 0)}
                />
              </Field>
              <Field label="Comissão (R$)">
                <input
                  name="commissionAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  defaultValue={Number(editLine.commissionAmount ?? 0)}
                />
              </Field>
              <Field label="Ajuda de custo (R$)">
                <input
                  name="ajudaCustoAmount"
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  defaultValue={Number(editLine.ajudaCustoAmount ?? 0)}
                />
              </Field>
            </div>
            <SubmitButton label="Recalcular linha" />
          </form>
        ) : null}
      </Modal>

      <Modal title="Gerar folha" open={modal === 'include'} onClose={() => setModal(null)}>
        <form onSubmit={createRun}>
          <Field label="Competência (AAAA-MM)">
            <input
              name="yearMonth"
              className={inputClass}
              required
              placeholder="2026-03"
              pattern="\d{4}-\d{2}"
              defaultValue={currentYearMonthLocal()}
            />
          </Field>
          <SubmitButton label="Gerar" />
        </form>
      </Modal>

      <ModuleReportsModal open={reportsOpen} title="Folha de pagamento" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}

export default function FolhaPage() {
  return (
    <Suspense
      fallback={<p className="p-6 text-sm text-slate-600">Carregando…</p>}
    >
      <FolhaPageContent />
    </Suspense>
  );
}
