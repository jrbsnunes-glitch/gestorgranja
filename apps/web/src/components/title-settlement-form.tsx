'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Field, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';

function money(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

type Props = {
  formId: string;
  kind: 'payable' | 'receivable';
  titleAmount: number;
  amountPaid: number;
  defaultChartAccountId: string;
  onSubmit: (payload: {
    amount: number;
    settlementDate: string;
    notes: string;
    chartAccountId: string;
  }) => void;
};

export function TitleSettlementForm({
  formId,
  kind,
  titleAmount,
  amountPaid,
  defaultChartAccountId,
  onSubmit,
}: Props) {
  const remaining = Math.max(0, Math.round((titleAmount - amountPaid) * 100) / 100);
  const today = new Date().toISOString().slice(0, 10);
  const [amountStr, setAmountStr] = useState(String(remaining || ''));

  const payAmount = useMemo(() => {
    const n = Number(amountStr.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  const afterBalance = useMemo(() => {
    if (payAmount <= 0) return remaining;
    return Math.max(0, Math.round((remaining - payAmount) * 100) / 100);
  }, [payAmount, remaining]);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      amount: payAmount,
      settlementDate: String(fd.get('settlementDate') || today),
      notes: String(fd.get('notes') || '').trim(),
      chartAccountId: String(fd.get('chartAccountId') || defaultChartAccountId),
    });
  }

  const flow = kind === 'payable' ? 'payable' : 'receivable';

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm text-slate-600">
        Valor do título: {money(titleAmount)} — Já {kind === 'payable' ? 'pago' : 'recebido'}:{' '}
        {money(amountPaid)} — <strong>Saldo em aberto: {money(remaining)}</strong>
      </p>
      <Field label="Valor desta baixa (R$)">
        <input
          name="amount"
          type="number"
          step="0.01"
          min={0.01}
          max={remaining}
          className={inputClass}
          required
          value={amountStr}
          onChange={(e) => setAmountStr(e.target.value)}
        />
      </Field>
      {payAmount > 0 && payAmount < remaining - 0.004 ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Baixa parcial: após este lançamento restará <strong>{money(afterBalance)}</strong> em aberto.
        </p>
      ) : null}
      {payAmount >= remaining - 0.004 && remaining > 0 ? (
        <p className="text-sm text-emerald-800">Esta baixa liquida o título.</p>
      ) : null}
      <Field label="Data">
        <input name="settlementDate" type="date" className={inputClass} defaultValue={today} required />
      </Field>
      <Field label="Centro de custos / conta contábil">
        <ChartAccountSelect
          name="chartAccountId"
          flow={flow}
          required
          defaultValue={defaultChartAccountId}
        />
      </Field>
      <Field label="Observação">
        <textarea name="notes" className={inputClass} rows={3} placeholder="Histórico, comprovante, banco…" />
      </Field>
    </form>
  );
}
