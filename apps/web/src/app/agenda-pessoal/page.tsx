'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { FormCadastroModal, PageIntro } from '@/components/crud';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { businessTodayDayKey, formatCalendarDatePtBR, prismaDateDayKey } from '@/lib/calendar-date';
import { titleDueDayOffset } from '@/lib/finance-title-due';
import { formatBrl } from '@/lib/money';
import { PERSONAL_BILL_KINDS, PersonalBillDescription } from '@/components/agenda/personal-bill-kind';
import { PersonalBillPayForm } from '@/components/agenda/personal-bill-pay-form';

type PersonalBill = {
  id: string;
  description: string;
  amount: string;
  dueDate: string;
  status: 'OPEN' | 'PAID';
  amountPaid?: string;
  installmentIndex: number | null;
  installmentCount: number | null;
  category?: string | null;
};

type StatusFilter = 'todos' | 'vencidas' | 'pendentes' | 'pagas';

function billTone(b: PersonalBill): 'paid' | 'overdue' | 'pending' {
  if (b.status === 'PAID') return 'paid';
  if (titleDueDayOffset(b.dueDate) < 0) return 'overdue';
  return 'pending';
}

function statusLabel(b: PersonalBill) {
  const tone = billTone(b);
  if (tone === 'paid') return 'Paga';
  if (tone === 'overdue') return 'Vencida';
  return 'Pendente';
}

export default function AgendaPessoalPage() {
  const router = useRouter();
  const [items, setItems] = useState<PersonalBill[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [month, setMonth] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [edit, setEdit] = useState<PersonalBill | null>(null);
  const [paying, setPaying] = useState<PersonalBill | null>(null);

  const load = useCallback(() => {
    void apiFetch<{ items: PersonalBill[] }>('/v1/personal-agenda')
      .then((d) => setItems(d.items))
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar agenda'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const months = useMemo(() => {
    const set = new Set(items.map((b) => prismaDateDayKey(b.dueDate).slice(0, 7)));
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((b) => {
      if (q && !b.description.toLowerCase().includes(q)) return false;
      if (month !== 'todos' && !prismaDateDayKey(b.dueDate).startsWith(month)) return false;
      const tone = billTone(b);
      if (status === 'pagas' && tone !== 'paid') return false;
      if (status === 'vencidas' && tone !== 'overdue') return false;
      if (status === 'pendentes' && tone !== 'pending') return false;
      return true;
    });
  }, [items, query, month, status]);

  const kpis = useMemo(() => {
    const todayMonth = businessTodayDayKey().slice(0, 7);
    let overdue = 0;
    let overdueCount = 0;
    let pending = 0;
    let pendingCount = 0;
    let paid = 0;
    let paidCount = 0;
    let monthOpen = 0;
    for (const b of items) {
      const tone = billTone(b);
      const amount = Number(b.amount);
      if (tone === 'overdue') {
        overdue += amount;
        overdueCount += 1;
      } else if (tone === 'pending') {
        pending += amount;
        pendingCount += 1;
      } else {
        paid += amount;
        paidCount += 1;
      }
      if (prismaDateDayKey(b.dueDate).startsWith(todayMonth) && tone !== 'paid') {
        monthOpen += amount;
      }
    }
    return { overdue, overdueCount, pending, pendingCount, paid, paidCount, monthOpen };
  }, [items]);

  const upcoming = useMemo(
    () =>
      items
        .filter((b) => b.status === 'OPEN')
        .sort((a, b) => prismaDateDayKey(a.dueDate).localeCompare(prismaDateDayKey(b.dueDate)))
        .slice(0, 5),
    [items],
  );

  async function createBill(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/personal-agenda', {
        method: 'POST',
        body: JSON.stringify({
          description: fd.get('description'),
          category: fd.get('category'),
          amount: Number(fd.get('amount')),
          dueDate: fd.get('dueDate'),
          installments: Number(fd.get('installments') || 1),
        }),
      });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao incluir');
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!edit) return;
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/v1/personal-agenda/${edit.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          description: fd.get('description'),
          category: fd.get('category'),
          amount: Number(fd.get('amount')),
          dueDate: fd.get('dueDate'),
        }),
      });
      setEdit(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar');
    }
  }

  async function submitPay(payload: {
    amount: number;
    settlementDate: string;
    notes: string;
    paymentLabel: string;
  }) {
    if (!paying) return;
    setError(null);
    try {
      await apiFetch(`/v1/personal-agenda/${paying.id}/pay`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setPaying(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar pagamento');
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir esta conta da agenda pessoal?')) return;
    setError(null);
    try {
      await apiFetch(`/v1/personal-agenda/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir');
    }
  }

  return (
    <AdminShell title="Agenda Pessoal">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <PageIntro
          title="Agenda de Pagamentos Pessoais"
          description="Controle seus pagamentos pessoais. Esses registros não afetam o caixa da Granja Aurora."
          showModuleTabs={false}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => router.push('/agenda-pessoal/relatorios')}>
            Relatórios
          </Button>
          <Button type="button" onClick={() => setFormOpen(true)}>
            + Nova conta
          </Button>
        </div>
      </div>
      <ErrorBox message={error} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Vencidas" value={formatBrl(kpis.overdue)} hint={`${kpis.overdueCount}`} tone="rose" />
        <Kpi label="Pendentes" value={formatBrl(kpis.pending)} hint={`${kpis.pendingCount}`} tone="amber" />
        <Kpi label="Pagas" value={formatBrl(kpis.paid)} hint={`${kpis.paidCount}`} tone="emerald" />
        <Kpi label="Total mensal" value={formatBrl(kpis.monthOpen)} hint="pendentes + vencidas do mês" tone="slate" />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm xl:col-span-8">
          <div className="flex flex-col gap-2 border-b border-slate-100 p-3 lg:flex-row">
            <input
              className={inputClass}
              placeholder="Buscar conta…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
              <option value="todos">Todos os status</option>
              <option value="vencidas">Vencidas</option>
              <option value="pendentes">Pendentes</option>
              <option value="pagas">Pagas</option>
            </select>
            <select className={inputClass} value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="todos">Todos os meses</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {m.split('-').reverse().join('/')}
                </option>
              ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Vencimento</th>
                  <th className="px-3 py-2.5">Descrição</th>
                  <th className="px-3 py-2.5 text-right">Valor</th>
                  <th className="px-3 py-2.5">Parcelas</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-500">
                      Nenhuma conta pessoal nesta visão.
                    </td>
                  </tr>
                ) : (
                  filtered.map((b) => {
                    const tone = billTone(b);
                    const cls =
                      tone === 'paid'
                        ? 'bg-emerald-100 text-emerald-900'
                        : tone === 'overdue'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-950';
                    return (
                      <tr key={b.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5 tabular-nums">{formatCalendarDatePtBR(b.dueDate)}</td>
                        <td className="px-3 py-2.5">
                          <PersonalBillDescription kind={b.category} description={b.description} />
                        </td>
                        <td className="px-3 py-2.5 text-right font-medium tabular-nums">
                          {formatBrl(Number(b.amount))}
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {b.installmentIndex && b.installmentCount
                            ? `${b.installmentIndex} de ${b.installmentCount}`
                            : '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
                            {statusLabel(b)}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {b.status === 'OPEN' ? (
                              <Button type="button" className="px-2 py-1 text-xs" onClick={() => setPaying(b)}>
                                Pagar
                              </Button>
                            ) : null}
                            {b.status === 'OPEN' ? (
                              <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => setEdit(b)}>
                                Alterar
                              </Button>
                            ) : null}
                            <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => void remove(b.id)}>
                              Excluir
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
            Mostrando {filtered.length} conta(s)
          </p>
        </div>

        <aside className="space-y-4 xl:col-span-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Resumo do mês</h3>
            <ul className="space-y-1 text-sm">
              <li className="flex justify-between">
                <span>Vencidas</span>
                <span className="font-medium text-red-700">{formatBrl(kpis.overdue)}</span>
              </li>
              <li className="flex justify-between">
                <span>Pendentes</span>
                <span className="font-medium text-amber-800">{formatBrl(kpis.pending)}</span>
              </li>
              <li className="flex justify-between">
                <span>Pagas</span>
                <span className="font-medium text-emerald-800">{formatBrl(kpis.paid)}</span>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Próximos vencimentos</h3>
            {upcoming.length === 0 ? (
              <p className="text-sm text-slate-500">Nada em aberto.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {upcoming.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 tabular-nums text-slate-500">
                        {formatCalendarDatePtBR(b.dueDate).slice(0, 5)}
                      </span>
                      <span className="min-w-0 truncate">
                        <PersonalBillDescription kind={b.category} description={b.description} />
                      </span>
                    </span>
                    <span className="shrink-0 font-medium tabular-nums">{formatBrl(Number(b.amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            Essas contas são apenas para o seu controle pessoal e não afetam o caixa da granja.
          </p>
        </aside>
      </div>

      <FormCadastroModal
        open={paying != null}
        onClose={() => setPaying(null)}
        title="Registrar pagamento"
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setPaying(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="personal-bill-pay">
              Confirmar pagamento
            </Button>
          </>
        }
      >
        {paying ? (
          <PersonalBillPayForm
            key={paying.id}
            formId="personal-bill-pay"
            description={paying.description}
            category={paying.category}
            dueDate={paying.dueDate}
            amount={Number(paying.amount)}
            amountPaid={Number(paying.amountPaid ?? 0)}
            onSubmit={(payload) => void submitPay(payload)}
          />
        ) : null}
      </FormCadastroModal>

      <FormCadastroModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Nova conta pessoal"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="personal-bill-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="personal-bill-form" onSubmit={createBill} className="grid gap-3">
          <Field label="Tipo">
            <select name="category" className={inputClass} defaultValue="OUTROS" required>
              {PERSONAL_BILL_KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Descrição">
            <input name="description" className={inputClass} required placeholder="Ex.: Conta de luz (apto)" />
          </Field>
          <Field label="Valor (R$)">
            <input name="amount" type="number" step="0.01" min={0.01} className={inputClass} required />
          </Field>
          <Field label="1º vencimento">
            <input name="dueDate" type="date" className={inputClass} required />
          </Field>
          <Field label="Parcelas">
            <input name="installments" type="number" min={1} max={60} defaultValue={1} className={inputClass} />
          </Field>
          <p className="text-xs text-slate-500">
            Parcelas geram vencimentos mensais só nesta agenda. Nada é lançado no financeiro da granja.
          </p>
        </form>
      </FormCadastroModal>

      <FormCadastroModal
        open={edit != null}
        onClose={() => setEdit(null)}
        title="Alterar conta pessoal"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEdit(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="personal-bill-edit">
              Salvar
            </Button>
          </>
        }
      >
        {edit ? (
          <form id="personal-bill-edit" key={edit.id} onSubmit={saveEdit} className="grid gap-3">
            <Field label="Tipo">
              <select name="category" className={inputClass} defaultValue={edit.category || 'OUTROS'} required>
                {PERSONAL_BILL_KINDS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descrição">
              <input name="description" className={inputClass} required defaultValue={edit.description} />
            </Field>
            <Field label="Valor (R$)">
              <input
                name="amount"
                type="number"
                step="0.01"
                min={0.01}
                className={inputClass}
                required
                defaultValue={Number(edit.amount)}
              />
            </Field>
            <Field label="Vencimento">
              <input name="dueDate" type="date" className={inputClass} required defaultValue={prismaDateDayKey(edit.dueDate)} />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>
    </AdminShell>
  );
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone: 'rose' | 'amber' | 'emerald' | 'slate';
}) {
  const cls =
    tone === 'rose'
      ? 'border-red-200 bg-red-50'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'emerald'
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-slate-50';
  return (
    <div className={`rounded-xl border px-4 py-3 ${cls}`}>
      <p className="text-xs font-medium text-slate-600">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{hint}</p>
    </div>
  );
}
