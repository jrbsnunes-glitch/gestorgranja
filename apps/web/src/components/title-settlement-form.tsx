'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Field, inputClass } from '@/components/ui-parts';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { ExpenseTypeField } from '@/components/finance/expense-type-field';
import { apiFetch } from '@/lib/api';
import { formatBrl } from '@/lib/money';

type PaymentChoice = { id: string; name: string; kind: string };

type Props = {
  formId: string;
  kind: 'payable' | 'receivable';
  titleAmount: number;
  amountPaid: number;
  defaultChartAccountId: string;
  defaultExpenseTypeId?: string;
  partnerName?: string;
  reference?: string;
  referenceDate?: string;
  onSubmit: (payload: {
    amount: number;
    settlementDate: string;
    notes: string;
    chartAccountId: string;
    expenseTypeId?: string;
  }) => void;
};

export function TitleSettlementForm({
  formId,
  kind,
  titleAmount,
  amountPaid,
  defaultChartAccountId,
  defaultExpenseTypeId,
  partnerName,
  reference,
  referenceDate,
  onSubmit,
}: Props) {
  const remaining = Math.max(0, Math.round((titleAmount - amountPaid) * 100) / 100);
  const today = new Date().toISOString().slice(0, 10);
  const [amountStr, setAmountStr] = useState(String(remaining || ''));
  const [paymentForms, setPaymentForms] = useState<PaymentChoice[]>([]);
  const [paymentName, setPaymentName] = useState('');
  const receiveLayout = kind === 'receivable';

  useEffect(() => {
    if (!receiveLayout) return;
    void apiFetch<PaymentChoice[]>('/v1/cadastros/payment-forms?activeOnly=1')
      .then((rows) => {
        const list = rows.filter((f) => f.kind !== 'REQUISICAO' && f.kind !== 'BOLETO');
        setPaymentForms(list);
        setPaymentName((cur) => cur || list[0]?.name || '');
      })
      .catch(() => setPaymentForms([]));
  }, [receiveLayout]);

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
    const userNotes = String(fd.get('notes') || '').trim();
    const paymentName = String(fd.get('paymentFormName') || '').trim();
    const notes = [paymentName ? `Forma: ${paymentName}` : '', userNotes].filter(Boolean).join(' — ');
    onSubmit({
      amount: payAmount,
      settlementDate: String(fd.get('settlementDate') || today),
      notes,
      chartAccountId: String(fd.get('chartAccountId') || defaultChartAccountId),
      expenseTypeId: String(fd.get('expenseTypeId') || '') || undefined,
    });
  }

  const flow = kind === 'payable' ? 'payable' : 'receivable';

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-3">
      {receiveLayout ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
            <p>
              <span className="text-slate-500">Cliente</span>
              <br />
              <strong className="text-slate-900">{partnerName || '—'}</strong>
            </p>
            <p className="text-right">
              <span className="text-slate-500">Venda</span>
              <br />
              <strong className="text-slate-900">
                {reference || '—'}
                {referenceDate ? ` · ${referenceDate}` : ''}
              </strong>
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Valor original</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{formatBrl(titleAmount)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs text-slate-500">Valor já recebido</p>
              <p className="text-lg font-semibold tabular-nums text-slate-900">{formatBrl(amountPaid)}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-800">Saldo devedor</p>
              <p className="text-lg font-semibold tabular-nums text-amber-950">{formatBrl(remaining)}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Valor do título: {formatBrl(titleAmount)} — Já pago: {formatBrl(amountPaid)} —{' '}
          <strong>Saldo em aberto: {formatBrl(remaining)}</strong>
        </p>
      )}
      <Field label={receiveLayout ? 'Valor a receber agora' : 'Valor desta baixa (R$)'}>
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
          Baixa parcial: após este lançamento restará <strong>{formatBrl(afterBalance)}</strong> em aberto.
        </p>
      ) : null}
      {payAmount >= remaining - 0.004 && remaining > 0 ? (
        <p className="text-sm text-emerald-800">Esta baixa liquida o título.</p>
      ) : null}
      {receiveLayout ? (
        <Field label="Forma de pagamento">
          <select
            name="paymentFormName"
            className={inputClass}
            value={paymentName}
            onChange={(e) => setPaymentName(e.target.value)}
          >
            {paymentForms.length === 0 ? <option value="">—</option> : null}
            {paymentForms.map((f) => (
              <option key={f.id} value={f.name}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <Field label="Data">
          <input name="settlementDate" type="date" className={inputClass} defaultValue={today} required />
        </Field>
      )}
      {kind === 'payable' ? <ExpenseTypeField defaultValue={defaultExpenseTypeId} /> : null}
      <Field label="Centro de custos / conta contábil">
        <ChartAccountSelect
          name="chartAccountId"
          flow={flow}
          required
          defaultValue={defaultChartAccountId}
        />
      </Field>
      {receiveLayout ? (
        <input type="hidden" name="settlementDate" value={today} />
      ) : null}
      <Field label={receiveLayout ? 'Observação (opcional)' : 'Observação'}>
        <textarea
          name="notes"
          className={inputClass}
          rows={3}
          placeholder={receiveLayout ? 'Ex.: Pagamento parcial…' : 'Histórico, comprovante, banco…'}
        />
      </Field>
    </form>
  );
}
