export type CashReportMovement = {
  id: string;
  type: string;
  isExpense?: boolean;
  amount: number;
  paymentMethod: string | null;
  reason: string | null;
  createdAt: string;
  sessionControlNumber?: number;
  operatorName?: string;
};

export function isSaleMovement(reason: string | null | undefined): boolean {
  return /^\s*venda\b/i.test(reason ?? '');
}

export function splitMovementsBySection(movements: CashReportMovement[]) {
  const sales: CashReportMovement[] = [];
  const receivablesAtCash: CashReportMovement[] = [];
  const expenses: CashReportMovement[] = [];

  for (const m of movements) {
    if (m.type === 'OUT') {
      expenses.push(m);
    } else if (isSaleMovement(m.reason)) {
      sales.push(m);
    } else if (m.type === 'IN') {
      receivablesAtCash.push(m);
    }
  }

  const sum = (rows: CashReportMovement[]) => rows.reduce((s, r) => s + r.amount, 0);

  return {
    sales,
    receivablesAtCash,
    expenses,
    totalSales: sum(sales),
    totalReceivablesAtCash: sum(receivablesAtCash),
    totalExpenses: sum(expenses),
  };
}
