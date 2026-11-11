'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud';
import { PartnerLookupField } from '@/components/partner-lookup-field';
import { ProductLookupField, type ProductRow } from '@/components/product-lookup-field';
import { ErrorBox, Field, inputClass } from '@/components/ui-parts';
import { SaleDateNoticeBox, type SaleDateNotice } from '@/components/vendas/sale-date-notice';
import { apiFetch } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type PaymentForm = { id: string; name: string; kind: string; active?: boolean };

export function CashDirectSaleModal({
  open,
  sessionId,
  onClose,
  onCompleted,
}: {
  open: boolean;
  sessionId: string;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [partnerId, setPartnerId] = useState('');
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState('');
  const [paymentFormId, setPaymentFormId] = useState('');
  const [forms, setForms] = useState<PaymentForm[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPartnerId('');
    setProductId('');
    setQty('1');
    setPrice('');
    setPaymentFormId('');
    setError(null);
    setMessages([]);
    setDone(false);
    void apiFetch<PaymentForm[]>('/v1/cadastros/payment-forms?activeOnly=1')
      .then((rows) => {
        const usable = rows.filter((f) => f.kind !== 'REQUISICAO');
        setForms(usable);
        setPaymentFormId(usable[0]?.id ?? '');
      })
      .catch((e) => setError(errorMessage(e)));
  }, [open]);

  function onProduct(id: string, product: ProductRow | null) {
    setProductId(id);
    if (product?.salePrice != null && Number(product.salePrice) >= 0) {
      setPrice(String(product.salePrice));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const quantity = Number(qty.replace(',', '.'));
    const unitPrice = Number(price.replace(',', '.'));
    if (!partnerId || !productId) {
      setError('Informe cliente e produto.');
      return;
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      setError('Quantidade e preço inválidos.');
      return;
    }
    if (!paymentFormId) {
      setError('Escolha a forma de pagamento.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await apiFetch<{ id: string }>('/v1/commercial/orders', {
        method: 'POST',
        body: JSON.stringify({
          partnerId,
          paymentFormId,
          items: [{ productId, quantity, unitPrice, discount: 0 }],
        }),
      });
      await apiFetch(`/v1/commercial/orders/${created.id}/confirm`, {
        method: 'POST',
        body: JSON.stringify({ cashSessionId: sessionId }),
      });
      const notice = await apiFetch<SaleDateNotice>(`/v1/commercial/orders/${created.id}/date-notice`);
      setMessages(notice.messages);
      setDone(true);
      onCompleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormCadastroModal
      open={open}
      onClose={onClose}
      backdropClassName="z-[110]"
      title="Lançar venda no caixa"
      footer={
        done ? (
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" form="cash-direct-sale-form" disabled={busy}>
              {busy ? 'Registrando…' : 'Confirmar venda'}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="grid gap-3">
          <p className="text-sm text-emerald-800">Venda registrada neste caixa. O estoque foi baixado.</p>
          <SaleDateNoticeBox messages={messages} />
        </div>
      ) : (
        <form id="cash-direct-sale-form" onSubmit={submit} className="grid gap-3">
          <ErrorBox message={error} />
          <PartnerLookupField role="customer" value={partnerId} onValueChange={(id) => setPartnerId(id)} required />
          <ProductLookupField value={productId} onValueChange={onProduct} required />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantidade">
              <input
                className={inputClass}
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </Field>
            <Field label="Preço unitário (R$)">
              <input
                className={inputClass}
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </Field>
          </div>
          <Field label="Forma de pagamento">
            <select
              className={inputClass}
              value={paymentFormId}
              onChange={(e) => setPaymentFormId(e.target.value)}
              required
            >
              {forms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-xs text-slate-500">
            A venda usa a data de abertura deste caixa. Nota e boleto, se houver, continuam na data real de autorização.
          </p>
        </form>
      )}
    </FormCadastroModal>
  );
}
