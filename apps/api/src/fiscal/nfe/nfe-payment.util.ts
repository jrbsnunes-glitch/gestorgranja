export type NfePagRow = {
  tPag: string;
  vPag: number;
  xPag?: string;
  indPag: 0 | 1;
};

function money(n: number) {
  return Math.round(n * 100) / 100;
}

function sanitizeXPag(raw: string | null | undefined): string {
  const text = String(raw ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
  return text.length >= 2 ? text : 'Outros';
}

/** Meio do PDV → tPag da NF-e/NFC-e (mesma tabela usada no GestorVend). */
export function mapPaymentKindToNfePag(
  kind: string | null | undefined,
  name: string | null | undefined,
  amount: number,
): NfePagRow {
  const k = (kind ?? '').toUpperCase();
  const vPag = money(amount);
  if (k === 'CASH') return { tPag: '01', vPag, indPag: 0 };
  if (k === 'CARD') return { tPag: '03', vPag, indPag: 0 };
  if (k === 'PIX') return { tPag: '17', vPag, indPag: 0 };
  if (k === 'TRANSFER') return { tPag: '18', vPag, indPag: 0 };
  if (k === 'BOLETO') return { tPag: '15', vPag, indPag: 1 };
  if (k === 'REQUISICAO' || /requis/i.test(name ?? '')) return { tPag: '91', vPag, indPag: 1 };
  return { tPag: '99', vPag, xPag: sanitizeXPag(name), indPag: 0 };
}

export function salePaymentRows(order: {
  totalAmount: { toString(): string } | number;
  paymentMethod?: string | null;
  paymentForm?: { kind: string; name: string } | null;
  secondaryPaymentForm?: { kind: string; name: string } | null;
  primaryPaymentAmount?: { toString(): string } | number | null;
  secondaryPaymentFormId?: string | null;
}): NfePagRow[] {
  const total = money(Number(order.totalAmount));
  const primaryKind = order.paymentForm?.kind || order.paymentMethod;
  const primaryName = order.paymentForm?.name;
  if (order.secondaryPaymentFormId && order.primaryPaymentAmount != null && order.secondaryPaymentForm) {
    const primaryAmt = money(Number(order.primaryPaymentAmount));
    const secondaryAmt = money(total - primaryAmt);
    return [
      mapPaymentKindToNfePag(primaryKind, primaryName, primaryAmt),
      mapPaymentKindToNfePag(order.secondaryPaymentForm.kind, order.secondaryPaymentForm.name, secondaryAmt),
    ].filter((row) => row.vPag > 0.004);
  }
  return [mapPaymentKindToNfePag(primaryKind, primaryName, total)];
}
