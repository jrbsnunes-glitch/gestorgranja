import { prismaDateDayKey } from '@/lib/calendar-date';
import { titleDueDayOffset } from '@/lib/finance-title-due';
import { PERSONAL_BILL_KINDS } from '@/components/agenda/personal-bill-kind';

export type PersonalAgendaBillTone = 'paid' | 'open' | 'overdue';

export type PersonalAgendaReportFilters = {
  from: string;
  to: string;
  category: string;
  includePaid: boolean;
  includeOpen: boolean;
  includeOverdue: boolean;
};

export type PersonalAgendaReportBill = {
  id: string;
  description: string;
  amount: string | number;
  dueDate: string;
  status: string;
  category?: string | null;
  installmentIndex?: number | null;
  installmentCount?: number | null;
};

export function currentMonthRange(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export function defaultPersonalAgendaReportFilters(): PersonalAgendaReportFilters {
  const month = currentMonthRange();
  return {
    from: month.from,
    to: month.to,
    category: '',
    includePaid: true,
    includeOpen: true,
    includeOverdue: true,
  };
}

export function personalBillTone(status: string, dueDate: string): PersonalAgendaBillTone {
  if (status === 'PAID') return 'paid';
  if (titleDueDayOffset(dueDate) < 0) return 'overdue';
  return 'open';
}

export function personalBillToneLabel(tone: PersonalAgendaBillTone) {
  if (tone === 'paid') return 'Paga';
  if (tone === 'overdue') return 'Vencida';
  return 'Aberta';
}

export function personalBillKindLabel(kind?: string | null) {
  const id = (kind || 'OUTROS').toUpperCase();
  return PERSONAL_BILL_KINDS.find((k) => k.id === id)?.label ?? 'Outros';
}

export function filterPersonalAgendaBills<T extends PersonalAgendaReportBill>(
  items: T[],
  filters: PersonalAgendaReportFilters,
): T[] {
  return items.filter((bill) => {
    const day = prismaDateDayKey(bill.dueDate);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    if (filters.category && (bill.category || 'OUTROS').toUpperCase() !== filters.category) return false;
    const tone = personalBillTone(bill.status, bill.dueDate);
    if (tone === 'paid' && !filters.includePaid) return false;
    if (tone === 'open' && !filters.includeOpen) return false;
    if (tone === 'overdue' && !filters.includeOverdue) return false;
    return true;
  });
}

export function personalAgendaReportTotals(items: PersonalAgendaReportBill[]) {
  let paid = 0;
  let paidCount = 0;
  let open = 0;
  let openCount = 0;
  let overdue = 0;
  let overdueCount = 0;
  for (const bill of items) {
    const amount = Number(bill.amount) || 0;
    const tone = personalBillTone(bill.status, bill.dueDate);
    if (tone === 'paid') {
      paid += amount;
      paidCount += 1;
    } else if (tone === 'overdue') {
      overdue += amount;
      overdueCount += 1;
    } else {
      open += amount;
      openCount += 1;
    }
  }
  return {
    paid,
    paidCount,
    open,
    openCount,
    overdue,
    overdueCount,
    total: paid + open + overdue,
    count: items.length,
  };
}

export function personalAgendaReportQuery(filters: PersonalAgendaReportFilters) {
  const qs = new URLSearchParams();
  if (filters.from) qs.set('from', filters.from);
  if (filters.to) qs.set('to', filters.to);
  if (filters.category) qs.set('category', filters.category);
  qs.set('paid', filters.includePaid ? '1' : '0');
  qs.set('open', filters.includeOpen ? '1' : '0');
  qs.set('overdue', filters.includeOverdue ? '1' : '0');
  return qs;
}

export function parsePersonalAgendaReportQuery(sp: URLSearchParams): PersonalAgendaReportFilters {
  const flag = (key: string) => sp.get(key) !== '0';
  return {
    from: sp.get('from') ?? '',
    to: sp.get('to') ?? '',
    category: sp.get('category') ?? '',
    includePaid: flag('paid'),
    includeOpen: flag('open'),
    includeOverdue: flag('overdue'),
  };
}
