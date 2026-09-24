import { PaymentApprovalStatus, Prisma } from '../generated/tenant-client';

export function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

export function titleBalance(amount: Prisma.Decimal, amountPaid: Prisma.Decimal): number {
  return dec(amount) - dec(amountPaid);
}

export function isPayableSettled(row: {
  amount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  approvalStatus: PaymentApprovalStatus;
  paidAt?: Date | null;
}): boolean {
  const amount = dec(row.amount);
  const paid = dec(row.amountPaid);
  return (
    row.approvalStatus === PaymentApprovalStatus.PAID ||
    row.paidAt != null ||
    (amount > 0 && paid >= amount - 0.005)
  );
}

export function isReceivableSettled(row: {
  amount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  receivedAt?: Date | null;
}): boolean {
  const amount = dec(row.amount);
  const paid = dec(row.amountPaid);
  return row.receivedAt != null || (amount > 0 && paid >= amount - 0.005);
}

export function daysOverdue(dueDate: Date, today = new Date()): number {
  const d = new Date(dueDate);
  d.setHours(0, 0, 0, 0);
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  const diff = Math.floor((t.getTime() - d.getTime()) / 86400000);
  return diff > 0 ? diff : 0;
}

export type PaymentInstallment = { amount: number; dueDate: string };

/** Divide valor total em N parcelas mensais a partir do 1º vencimento. */
export function buildInstallmentsFromTotal(
  total: number,
  installments: number,
  firstDueDate: string,
): PaymentInstallment[] {
  const count = Math.max(1, Math.min(120, Math.floor(installments)));
  if (count === 1) return [{ amount: total, dueDate: firstDueDate }];
  const part = Math.round((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(firstDueDate + 'T12:00:00');
    d.setMonth(d.getMonth() + i);
    const amount = i === count - 1 ? Math.round((total - part * (count - 1)) * 100) / 100 : part;
    return { amount, dueDate: d.toISOString().slice(0, 10) };
  });
}

export function parsePaymentTerms(raw: unknown): PaymentInstallment[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (!x || typeof x !== 'object') return null;
      const o = x as { amount?: unknown; dueDate?: unknown };
      const amount = Number(o.amount);
      const dueDate = typeof o.dueDate === 'string' ? o.dueDate : '';
      if (!Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
      return { amount, dueDate };
    })
    .filter((x): x is PaymentInstallment => x != null);
}
