export type CashMovementSummaryRow = {
  type: string;
  amount: string | number;
  isExpense?: boolean;
  paymentMethod?: string | null;
};

export const CASH_PAYMENT_METHODS = ['CASH', 'PIX', 'CARD', 'TRANSFER'] as const;
export type CashPaymentMethod = (typeof CASH_PAYMENT_METHODS)[number];

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

export function paymentMethodsForSession(movements: CashMovementSummaryRow[]): string[] {
  const set = new Set<string>([...CASH_PAYMENT_METHODS]);
  for (const m of movements) {
    if (m.paymentMethod?.trim()) set.add(m.paymentMethod.trim().toUpperCase());
  }
  const ordered: string[] = CASH_PAYMENT_METHODS.filter((k) => set.has(k));
  for (const k of set) {
    if (!ordered.includes(k)) ordered.push(k);
  }
  return ordered;
}

/** Valor esperado por forma de pagamento na conferência de fechamento. */
export function summarizeCashSessionByPaymentMethod(
  openingBalance: string | number,
  movements: CashMovementSummaryRow[],
) {
  const methods = paymentMethodsForSession(movements);
  const expected: Record<string, number> = Object.fromEntries(methods.map((m) => [m, 0]));
  expected.CASH = (expected.CASH ?? 0) + Number(openingBalance);

  for (const m of movements) {
    const raw = (m.paymentMethod || 'CASH').trim().toUpperCase();
    const key = raw in expected ? raw : 'CASH';
    const v = Number(m.amount);
    if (m.type === 'IN') expected[key] += v;
    else expected[key] -= v;
  }

  for (const k of Object.keys(expected)) {
    expected[k] = roundMoney(expected[k]);
  }
  const totalExpected = roundMoney(Object.values(expected).reduce((s, n) => s + n, 0));
  return { expected, totalExpected, methods };
}

export function summarizeCashSession(
  openingBalance: string | number,
  movements: CashMovementSummaryRow[],
) {
  const opening = Number(openingBalance);
  let inflow = 0;
  let outflow = 0;
  let expenses = 0;
  for (const m of movements) {
    const v = Number(m.amount);
    if (m.type === 'IN') inflow += v;
    else {
      outflow += v;
      if (m.isExpense) expenses += v;
    }
  }
  const expectedBalance = opening + inflow - outflow;
  return { opening, inflow, outflow, expenses, expectedBalance };
}

export function cashMovementKindLabel(m: { type: string; isExpense?: boolean }): string {
  if (m.type === 'IN') return 'Entrada';
  return 'Despesa';
}
