export type CashMovementSummaryRow = {
  type: string;
  amount: string | number;
  isExpense?: boolean;
};

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
  if (m.isExpense) return 'Despesa';
  return 'Saída';
}
