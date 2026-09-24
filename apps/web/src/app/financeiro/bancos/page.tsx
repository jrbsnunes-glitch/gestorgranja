'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { apiFetch } from '@/lib/api';
import { navigateToReportPrint } from '@/lib/report-print-nav';

type BankRow = {
  id: string;
  bankName: string;
  agency: string;
  account: string;
  balance: string;
};

type BudgetProgressRow = {
  id: string;
  yearMonth: string;
  amountPlanned: number;
  actual: number;
  usedPct: number | null;
  remaining: number;
  chartAccount: { code: string; name: string };
};

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function progressBarClass(usedPct: number | null) {
  if (usedPct == null) return 'bg-slate-300';
  if (usedPct >= 100) return 'bg-red-600';
  if (usedPct >= 85) return 'bg-amber-500';
  return 'bg-emerald-600';
}

export default function FinanceiroBancosPage() {
  const [banks, setBanks] = useState<BankRow[]>([]);
  const [budgets, setBudgets] = useState<BudgetProgressRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const load = useCallback(() => {
    void apiFetch<BankRow[]>('/v1/finance/bank-accounts').then(setBanks);
    void apiFetch<BudgetProgressRow[]>(
      `/v1/finance/budget-lines?yearMonth=${encodeURIComponent(yearMonth)}&withProgress=1`,
    ).then(setBudgets);
  }, [yearMonth]);

  useEffect(() => {
    load();
  }, [load]);

  async function createBank(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await apiFetch('/v1/finance/bank-accounts', {
        method: 'POST',
        body: JSON.stringify({
          bankName: fd.get('bankName'),
          agency: fd.get('agency'),
          account: fd.get('account'),
          balance: Number(fd.get('balance')),
        }),
      });
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function saveBudget(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      await apiFetch('/v1/finance/budget-lines', {
        method: 'POST',
        body: JSON.stringify({
          yearMonth: fd.get('yearMonth'),
          chartAccountId: fd.get('chartAccountId'),
          amountPlanned: Number(fd.get('amountPlanned')),
        }),
      });
      form.reset();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  return (
    <AdminShell title="Financeiro — Bancos">
      <PageIntro
        title="Bancos e orçamento"
        description="Contas bancárias alimentam o saldo inicial do fluxo. Orçamento mensal compara CP pagas (e manutenção com a mesma conta contábil) com a meta planejada."
      />
      <ErrorBox message={error} />
      <PageCard title="Contas bancárias">
        <form onSubmit={createBank} className="mb-4 grid max-w-2xl gap-3 sm:grid-cols-2">
          <Field label="Banco">
            <input name="bankName" className={inputClass} required />
          </Field>
          <Field label="Agência">
            <input name="agency" className={inputClass} required />
          </Field>
          <Field label="Conta">
            <input name="account" className={inputClass} required />
          </Field>
          <Field label="Saldo (R$)">
            <input name="balance" type="number" step="0.01" className={inputClass} defaultValue={0} />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton label="Incluir conta" />
          </div>
        </form>
        <ul className="space-y-2 text-sm">
          {banks.map((b) => (
            <li key={b.id} className="flex justify-between rounded-md border border-slate-200 px-3 py-2">
              <span>
                {b.bankName} — ag. {b.agency} c/c {b.account}
              </span>
              <span className="font-medium tabular-nums">R$ {Number(b.balance).toFixed(2)}</span>
            </li>
          ))}
        </ul>
      </PageCard>
      <PageCard title="Orçamento mensal">
        <Field label="Mês (AAAA-MM)">
          <input
            className={`${inputClass} max-w-xs`}
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            pattern="\d{4}-\d{2}"
          />
        </Field>
        <form onSubmit={saveBudget} className="mt-3 grid max-w-2xl gap-3 sm:grid-cols-2">
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <Field label="Conta contábil">
            <ChartAccountSelect flow="payable" name="chartAccountId" required />
          </Field>
          <Field label="Valor planejado (R$)">
            <input name="amountPlanned" type="number" step="0.01" min={0} className={inputClass} required />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton label="Salvar linha de orçamento" />
          </div>
        </form>
        {budgets.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Nenhuma linha de orçamento para este mês.</p>
        ) : (
          <ResponsiveTableWrap className="mt-4">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-slate-500">
                  <th className="py-2">Conta contábil</th>
                  <th className="py-2 text-right">Planejado</th>
                  <th className="py-2 text-right">Realizado</th>
                  <th className="py-2 text-right">Saldo</th>
                  <th className="py-2 w-40">Uso</th>
                </tr>
              </thead>
              <tbody>
                {budgets.map((b) => (
                  <tr key={b.id} className="border-b border-slate-100">
                    <td className="py-2">
                      {b.chartAccount.code} — {b.chartAccount.name}
                    </td>
                    <td className="py-2 text-right tabular-nums">{money(b.amountPlanned)}</td>
                    <td className="py-2 text-right tabular-nums">{money(b.actual)}</td>
                    <td className="py-2 text-right tabular-nums">{money(b.remaining)}</td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full ${progressBarClass(b.usedPct)}`}
                            style={{ width: `${Math.min(b.usedPct ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs tabular-nums text-slate-600">
                          {b.usedPct != null ? `${b.usedPct}%` : '—'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ResponsiveTableWrap>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Realizado: CP pagas no mês com a mesma conta contábil. Manutenção de patrimônio entra só se informada com essa
          conta no cadastro da manutenção.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => navigateToReportPrint('/relatorios/financeiro/aging/impressao')}>
            Relatório aging CR
          </Button>
          <Link href="/financeiro/visao">
            <Button type="button" variant="secondary">
              Ver resumo na Visão
            </Button>
          </Link>
        </div>
      </PageCard>
    </AdminShell>
  );
}
