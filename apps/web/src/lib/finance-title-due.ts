import { businessTodayDayKey, dayKeysDiff, prismaDateDayKey } from '@/lib/calendar-date';

export type TitleDueUrgency = 'overdue' | 'dueToday' | 'normal';

/** Dias até o vencimento (negativo = atrasado). */
export function titleDueDayOffset(dueDateIso: string, now = new Date()) {
  const dueKey = prismaDateDayKey(dueDateIso);
  const todayKey = businessTodayDayKey(now);
  return dayKeysDiff(todayKey, dueKey);
}

export function titleDueUrgency(dueDateIso: string, now = new Date()): TitleDueUrgency {
  const diff = titleDueDayOffset(dueDateIso, now);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'dueToday';
  return 'normal';
}

export function titleDueRowClass(urgency: TitleDueUrgency): string {
  if (urgency === 'overdue') return 'bg-red-50/95 hover:bg-red-100/70';
  if (urgency === 'dueToday') return 'bg-amber-50/95 hover:bg-amber-100/70';
  return '';
}

export function titleDueMobileCardClass(urgency: TitleDueUrgency): string {
  if (urgency === 'overdue') return 'border-red-200 bg-red-50/90';
  if (urgency === 'dueToday') return 'border-amber-200 bg-amber-50/90';
  return 'border-slate-200 bg-white';
}
