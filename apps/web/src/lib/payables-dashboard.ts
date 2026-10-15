import { businessTodayDayKey, dayKeysDiff, prismaDateDayKey } from '@/lib/calendar-date';

export type PayableDashRow = {
  id: string;
  description: string;
  amount: string;
  amountPaid?: string;
  dueDate: string;
  approvalStatus: string;
  settled?: boolean;
  partner: { name: string };
  expenseType?: { name: string; iconKey: string } | null;
};

export function payableOpenBalance(p: PayableDashRow): number {
  if (p.settled) return 0;
  return Number(p.amount) - Number(p.amountPaid ?? 0);
}

export function isPayableSettledRow(p: PayableDashRow): boolean {
  return p.settled === true || p.approvalStatus === 'PAID' || payableOpenBalance(p) <= 0.004;
}

export function payableDueOffset(p: PayableDashRow): number {
  return dayKeysDiff(businessTodayDayKey(), prismaDateDayKey(p.dueDate));
}

export function payableStatusLabel(p: PayableDashRow): string {
  if (isPayableSettledRow(p)) return 'Pago';
  const diff = payableDueOffset(p);
  if (diff < 0) return 'Vencido';
  if (diff === 0) return 'Vence hoje';
  if (diff <= 3) return `Vence em ${diff} dia${diff === 1 ? '' : 's'}`;
  return 'Pendente';
}

export function payableStatusTone(p: PayableDashRow): 'paid' | 'overdue' | 'soon' | 'pending' {
  if (isPayableSettledRow(p)) return 'paid';
  const diff = payableDueOffset(p);
  if (diff < 0) return 'overdue';
  if (diff <= 3) return 'soon';
  return 'pending';
}

export function payablesDashboardKpis(items: PayableDashRow[]) {
  let dueToday = 0;
  let dueTodayCount = 0;
  let overdue = 0;
  let overdueCount = 0;
  let dueIn3 = 0;
  let dueIn3Count = 0;
  let monthTotal = 0;

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  for (const p of items) {
    const dueKey = prismaDateDayKey(p.dueDate);
    if (dueKey.startsWith(monthKey)) {
      monthTotal += Number(p.amount);
    }
    if (isPayableSettledRow(p)) continue;
    const bal = payableOpenBalance(p);
    const diff = payableDueOffset(p);
    if (diff === 0) {
      dueToday += bal;
      dueTodayCount += 1;
    }
    if (diff < 0) {
      overdue += bal;
      overdueCount += 1;
    }
    if (diff >= 1 && diff <= 3) {
      dueIn3 += bal;
      dueIn3Count += 1;
    }
  }

  return { dueToday, dueTodayCount, overdue, overdueCount, dueIn3, dueIn3Count, monthTotal };
}

export function upcomingPayables(items: PayableDashRow[], limit = 5): PayableDashRow[] {
  return items
    .filter((p) => !isPayableSettledRow(p))
    .sort((a, b) => payableDueOffset(a) - payableDueOffset(b))
    .slice(0, limit);
}
