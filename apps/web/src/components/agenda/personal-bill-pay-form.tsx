'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Field, inputClass } from '@/components/ui-parts';
import { PersonalBillDescription } from '@/components/agenda/personal-bill-kind';
import { formatCalendarDatePtBR } from '@/lib/calendar-date';
import { formatBrl } from '@/lib/money';

const PAYMENT_LABELS = ['Dinheiro', 'Pix', 'Cartão', 'Transferência'] as const;

export function PersonalBillPayForm({
  formId,
  description,
  category,
  dueDate,
  amount,
  amountPaid,
  onSubmit,
}: {
  formId: string;
  description: string;
  category?: string | null;
  dueDate: string;
  amount: number;
  amountPaid: number;
  onSubmit: (payload: {
    amount: number;
    settlementDate: string;
    notes: string;
    paymentLabel: string;
  }) => void;
}) {
  const remaining = Math.max(0, Math.round((amount - amountPaid) * 100) / 100);
  const today = new Date().toISOString().slice(0, 10);
  const [amountStr, setAmountStr] = useState(String(remaining || ''));
  const [paymentLabel, setPaymentLabel] = useState<string>(PAYMENT_LABELS[0]);

  const payAmount = useMemo(() => {
    const n = Number(amountStr.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }, [amountStr]);

  const afterBalance = Math.max(0, Math.round((remaining - payAmount) * 100) / 100);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      amount: payAmount,
      settlementDate: String(fd.get('settlementDate') || today),
      notes: String(fd.get('notes') || '').trim(),
      paymentLabel,
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <div>
          <span className="text-slate-500">Conta pessoal</span>
          <div className="mt-1">
            <PersonalBillDescription kind={category} description={description} />
          </div>
        </div>
        <p className="text-right">
          <span className="text-slate-500">Vencimento</span>
          <br />
          <strong className="text-slate-900">{formatCalendarDatePtBR(dueDate)}</strong>
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Valor original</p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">{formatBrl(amount)}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs text-slate-500">Valor já pago</p>
          <p className="text-lg font-semibold tabular-nums text-slate-900">{formatBrl(amountPaid)}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">Saldo em aberto</p>
          <p className="text-lg font-semibold tabular-nums text-amber-950">{formatBrl(remaining)}</p>
        </div>
      </div>

      <Field label="Valor a pagar agora">
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
          Pagamento parcial: após este lançamento restará <strong>{formatBrl(afterBalance)}</strong> em aberto.
        </p>
      ) : null}
      {payAmount >= remaining - 0.004 && remaining > 0 ? (
        <p className="text-sm text-emerald-800">Este pagamento quita a conta.</p>
      ) : null}

      <Field label="Forma de pagamento">
        <select
          className={inputClass}
          value={paymentLabel}
          onChange={(e) => setPaymentLabel(e.target.value)}
        >
          {PAYMENT_LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Data do pagamento">
        <input name="settlementDate" type="date" className={inputClass} defaultValue={today} required />
      </Field>
      <Field label="Observação (opcional)">
        <textarea name="notes" className={inputClass} rows={3} placeholder="Ex.: comprovante, banco…" />
      </Field>
      <p className="text-xs text-slate-500">Este pagamento fica só na agenda pessoal e não entra no caixa da granja.</p>
    </form>
  );
}
