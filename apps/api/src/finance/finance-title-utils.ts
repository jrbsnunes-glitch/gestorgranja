import {
  calendarDayKeyInTz,
  DEFAULT_BUSINESS_TZ,
  dayKeysDiff,
  prismaDateOnly,
  prismaDateToDayKey,
} from '../common/calendar-date.util';
import { PaymentApprovalStatus, Prisma } from '../generated/tenant-client';

export function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

export function titleBalance(amount: Prisma.Decimal, amountPaid: Prisma.Decimal): number {
  return dec(amount) - dec(amountPaid);
}

export function hasTitlePayment(amountPaid: Prisma.Decimal | number | string): boolean {
  return dec(amountPaid) > 0.005;
}

export function isTitleCancelled(status: PaymentApprovalStatus): boolean {
  return status === PaymentApprovalStatus.CANCELLED;
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
  const dueKey = prismaDateToDayKey(dueDate);
  const todayKey = calendarDayKeyInTz(today, DEFAULT_BUSINESS_TZ);
  const diff = dayKeysDiff(dueKey, todayKey);
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
    const d = prismaDateOnly(firstDueDate);
    d.setUTCMonth(d.getUTCMonth() + i);
    const amount = i === count - 1 ? Math.round((total - part * (count - 1)) * 100) / 100 : part;
    return { amount, dueDate: prismaDateToDayKey(d) };
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
