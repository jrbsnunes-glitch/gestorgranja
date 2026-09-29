'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud/form-cadastro-modal';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';
import { ChartAccountSelect } from '@/components/chart-account-select';
import { PartnerLookupField } from '@/components/partner-lookup-field';
import { ProductLookupField } from '@/components/product-lookup-field';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { navigateToReportPrint } from '@/lib/report-print-nav';
import { formatBrl } from '@/lib/money';

type PaymentForm = {
  id: string;
  name: string;
  kind: string;
  colorHex: string;
};

type CartLine = {
  key: string;
  productId: string;
  label: string;
  quantity: number;
  unitPrice: number;
  discount: number;
};

function lineTotal(l: CartLine) {
  return l.quantity * l.unitPrice - l.discount;
}

export function MiniPdvModal({
  open,
  onClose,
  title,
  cashSessionId,
  onCompleted,
  onExpenseRecorded,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Sessão de caixa aberta — despesas são lançadas nesta sessão. */
  cashSessionId: string;
  onCompleted?: () => void;
  onExpenseRecorded?: () => void;
}) {
  const [step, setStep] = useState<'cart' | 'pay'>('cart');
  const [partnerId, setPartnerId] = useState('');
  const [draftProductId, setDraftProductId] = useState('');
  const [draftLabel, setDraftLabel] = useState('');
  const [draftQty, setDraftQty] = useState('1');
  const [draftPrice, setDraftPrice] = useState('');
  const [draftDiscount, setDraftDiscount] = useState('0');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [paymentForms, setPaymentForms] = useState<PaymentForm[]>([]);
  const [splitPay, setSplitPay] = useState(false);
  const [splitPrimaryFormId, setSplitPrimaryFormId] = useState<string | null>(null);
  const [splitSecondaryFormId, setSplitSecondaryFormId] = useState<string | null>(null);
  const [splitPrimaryAmount, setSplitPrimaryAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseBusy, setExpenseBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStep('cart');
    setPartnerId('');
    setDraftProductId('');
    setDraftLabel('');
    setDraftQty('1');
    setDraftPrice('');
    setDraftDiscount('0');
    setLines([]);
    setSplitPay(false);
    setSplitPrimaryFormId(null);
    setSplitSecondaryFormId(null);
    setSplitPrimaryAmount('');
    setExpenseOpen(false);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    void apiFetch<PaymentForm[]>('/v1/cadastros/payment-forms?activeOnly=1').then(setPaymentForms);
  }, [open, reset]);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + lineTotal(l), 0), [lines]);

  function addLine() {
    setError(null);
    const quantity = Number(draftQty);
    const unitPrice = Number(draftPrice);
    const discount = Number(draftDiscount) || 0;
    if (!draftProductId || !partnerId) {
      setError('Informe cliente e produto.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Quantidade e preço inválidos.');
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${draftProductId}-${Date.now()}`,
        productId: draftProductId,
        label: draftLabel,
        quantity,
        unitPrice,
        discount,
      },
    ]);
    setDraftProductId('');
    setDraftLabel('');
    setDraftQty('1');
    setDraftPrice('');
    setDraftDiscount('0');
  }

  const splitPrimaryNum = splitPrimaryAmount === '' ? NaN : Number(splitPrimaryAmount);
  const splitRemainder =
    splitPay && Number.isFinite(splitPrimaryNum)
      ? Math.round((subtotal - splitPrimaryNum) * 100) / 100
      : null;

  async function finishSale(payload: {
    paymentFormId: string;
    primaryPaymentAmount?: number;
    secondaryPaymentFormId?: string;
  }) {
    if (!partnerId || lines.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>('/v1/commercial/orders', {
        method: 'POST',
        body: JSON.stringify({
          partnerId,
          paymentFormId: payload.paymentFormId,
          primaryPaymentAmount: payload.primaryPaymentAmount,
          secondaryPaymentFormId: payload.secondaryPaymentFormId,
          items: lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
          })),
        }),
      });
      await apiFetch(`/v1/commercial/orders/${created.id}/confirm`, { method: 'POST', body: '{}' });
      onClose();
      onCompleted?.();
      navigateToReportPrint(
        `/vendas/impressao?id=${encodeURIComponent(created.id)}&autoprint=1`,
        '/vendas',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar venda');
    } finally {
      setBusy(false);
    }
  }

  function finishWithPayment(form: PaymentForm) {
    if (splitPay) return;
    void finishSale({ paymentFormId: form.id });
  }

  async function submitExpense(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setExpenseBusy(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch(`/v1/cash/sessions/${cashSessionId}/movements`, {
        method: 'POST',
        body: JSON.stringify({
          type: 'OUT',
          isExpense: true,
          amount: Number(fd.get('amount')),
          chartAccountId: fd.get('chartAccountId'),
          reason: String(fd.get('reason') || '').trim() || undefined,
          paymentMethod: 'CASH',
        }),
      });
      (e.target as HTMLFormElement).reset();
      setExpenseOpen(false);
      onExpenseRecorded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao lançar despesa');
    } finally {
      setExpenseBusy(false);
    }
  }

  function confirmSplitPayment() {
    if (!splitPrimaryFormId || !splitSecondaryFormId) {
      setError('Selecione as duas formas de pagamento.');
      return;
    }
    if (!Number.isFinite(splitPrimaryNum) || splitPrimaryNum <= 0 || splitPrimaryNum >= subtotal - 0.004) {
      setError('Informe um valor válido na 1ª forma (menor que o total).');
      return;
    }
    void finishSale({
      paymentFormId: splitPrimaryFormId,
      primaryPaymentAmount: splitPrimaryNum,
      secondaryPaymentFormId: splitSecondaryFormId,
    });
  }

  if (!open) return null;

  return (
    <ModalBackdrop onClose={onClose} wide fitViewport>
      <div className="flex max-h-[min(92vh,900px)] flex-col overflow-hidden">
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-800 to-teal-700 px-4 py-3 text-white sm:px-6">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-emerald-50/90">Mini PDV — inclua itens e finalize com a forma de pagamento.</p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6 lg:flex-row">
          {step === 'cart' ? (
            <>
              <div className="lg:w-[min(100%,22rem)] lg:shrink-0">
                <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-sky-900">Cliente</p>
                  <PartnerLookupField role="customer" value={partnerId} onValueChange={(id) => setPartnerId(id)} required />
                </div>
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-amber-950">Novo item</p>
                  <ProductLookupField
                    value={draftProductId}
                    onValueChange={(id, product) => {
                      setDraftProductId(id);
                      if (product) {
                        setDraftLabel(`${product.sku} — ${product.name}`);
                        if (product.salePrice != null) setDraftPrice(String(product.salePrice));
                      }
                    }}
                    label="Produto"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Qtd">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step="0.001"
                        value={draftQty}
                        onChange={(e) => setDraftQty(e.target.value)}
                      />
                    </Field>
                    <Field label="Preço un.">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step="0.01"
                        value={draftPrice}
                        onChange={(e) => setDraftPrice(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Desconto (R$)">
                    <input
                      className={inputClass}
                      type="number"
                      min={0}
                      step="0.01"
                      value={draftDiscount}
                      onChange={(e) => setDraftDiscount(e.target.value)}
                    />
                  </Field>
                  <Button type="button" className="mt-2 w-full" onClick={addLine}>
                    + Incluir na venda
                  </Button>
                </div>
              </div>

              <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
                  <p className="text-sm font-semibold text-slate-800">Itens da venda</p>
                </div>
                {lines.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">Nenhum item — adicione produtos à esquerda.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {lines.map((l) => (
                      <li key={l.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-900">{l.label}</p>
                          <p className="text-xs text-slate-500">
                            {l.quantity} × {formatBrl(l.unitPrice)}
                            {l.discount > 0 ? ` · desc. ${formatBrl(l.discount)}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums text-emerald-900">{formatBrl(lineTotal(l))}</span>
                          <Button
                            type="button"
                            variant="secondary"
                            className="px-2 py-1 text-xs"
                            onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                          >
                            Remover
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="border-t border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-emerald-950">Total</span>
                    <span className="text-xl font-bold tabular-nums text-emerald-900">{formatBrl(subtotal)}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="w-full">
              <p className="mb-2 text-sm text-slate-600">Total da venda: {formatBrl(subtotal)}</p>
              <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  checked={splitPay}
                  onChange={(e) => {
                    setSplitPay(e.target.checked);
                    setSplitPrimaryFormId(null);
                    setSplitSecondaryFormId(null);
                    setSplitPrimaryAmount('');
                    setError(null);
                  }}
                />
                Cliente paga em duas formas
              </label>

              {!splitPay ? (
                <>
                  <p className="mb-4 text-sm font-medium text-slate-800">Escolha a forma de pagamento:</p>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {paymentForms.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        disabled={busy}
                        className="rounded-xl border-2 px-4 py-6 text-left text-white shadow-md transition hover:brightness-110 disabled:opacity-60"
                        style={{ backgroundColor: f.colorHex, borderColor: f.colorHex }}
                        onClick={() => finishWithPayment(f)}
                      >
                        <span className="text-lg font-bold">{f.name}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <Field label="Valor pago na 1ª forma (R$)">
                    <input
                      className={inputClass}
                      type="number"
                      min={0.01}
                      step="0.01"
                      max={Math.max(0, subtotal - 0.01)}
                      value={splitPrimaryAmount}
                      onChange={(e) => setSplitPrimaryAmount(e.target.value)}
                      placeholder={subtotal.toFixed(2)}
                    />
                  </Field>
                  {splitRemainder != null && splitRemainder >= 0.01 ? (
                    <p className="text-sm text-slate-700">
                      Restante na 2ª forma: <strong className="tabular-nums">{formatBrl(splitRemainder)}</strong>
                    </p>
                  ) : null}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">1ª forma</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {paymentForms.map((f) => (
                        <button
                          key={`p1-${f.id}`}
                          type="button"
                          disabled={busy}
                          className={`rounded-lg border-2 px-3 py-3 text-left text-sm font-semibold text-white disabled:opacity-60 ${
                            splitPrimaryFormId === f.id ? 'ring-2 ring-offset-2 ring-slate-800' : ''
                          }`}
                          style={{ backgroundColor: f.colorHex, borderColor: f.colorHex }}
                          onClick={() => {
                            setSplitPrimaryFormId(f.id);
                            if (splitSecondaryFormId === f.id) setSplitSecondaryFormId(null);
                          }}
                        >
                          {f.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">2ª forma</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {paymentForms
                        .filter((f) => f.id !== splitPrimaryFormId)
                        .map((f) => (
                          <button
                            key={`p2-${f.id}`}
                            type="button"
                            disabled={busy || !splitPrimaryFormId}
                            className={`rounded-lg border-2 px-3 py-3 text-left text-sm font-semibold text-white disabled:opacity-60 ${
                              splitSecondaryFormId === f.id ? 'ring-2 ring-offset-2 ring-slate-800' : ''
                            }`}
                            style={{ backgroundColor: f.colorHex, borderColor: f.colorHex }}
                            onClick={() => setSplitSecondaryFormId(f.id)}
                          >
                            {f.name}
                          </button>
                        ))}
                    </div>
                  </div>
                  <Button
                    type="button"
                    disabled={busy || !splitPrimaryFormId || !splitSecondaryFormId}
                    onClick={confirmSplitPayment}
                  >
                    Finalizar venda
                  </Button>
                </div>
              )}

              {paymentForms.length === 0 ? (
                <p className="text-sm text-amber-800">
                  Cadastre formas em Cadastros → Formas de pagamento.
                </p>
              ) : null}
            </div>
          )}
        </div>

        {error ? <p className="px-4 pb-2 text-sm text-red-700">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-6">
          <div>
            {step === 'cart' ? (
              <Button
                type="button"
                variant="secondary"
                disabled={busy || expenseBusy}
                onClick={() => {
                  setError(null);
                  setExpenseOpen(true);
                }}
              >
                Despesas
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancelar
            </Button>
            {step === 'cart' ? (
              <Button
                type="button"
                disabled={lines.length === 0 || !partnerId}
                onClick={() => {
                  setError(null);
                  setStep('pay');
                }}
              >
                Confirmar venda…
              </Button>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setStep('cart')}>
                Voltar aos itens
              </Button>
            )}
          </div>
        </div>
      </div>

      <FormCadastroModal
        open={expenseOpen}
        onClose={() => setExpenseOpen(false)}
        title="Despesas"
        hint="Lançamento no caixa aberto — data e sessão são preenchidos automaticamente."
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setExpenseOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="cash-expense-form" disabled={expenseBusy}>
              Lançar despesa
            </Button>
          </>
        }
      >
        <form id="cash-expense-form" onSubmit={submitExpense} className="grid gap-3">
          <Field label="Valor (R$)">
            <input name="amount" type="number" step="0.01" min={0.01} className={inputClass} required />
          </Field>
          <Field label="Centro de custo">
            <ChartAccountSelect flow="payable" required />
          </Field>
          <Field label="Observação">
            <input
              name="reason"
              className={inputClass}
              placeholder="Ex.: combustível, material de limpeza…"
            />
          </Field>
        </form>
      </FormCadastroModal>
    </ModalBackdrop>
  );
}
