import { businessTodayDayKey } from '@/lib/calendar-date';
import type { FinancePeriodPreset } from '@/components/finance/finance-titles-toolbar';
import type { DateRangeFilter } from '@/lib/list-filters';

export function financeMonthRange(now = new Date()): DateRangeFilter {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}

export function financeNext7DaysRange(): DateRangeFilter {
  const from = businessTodayDayKey();
  const end = new Date(`${from}T12:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 7);
  const to = end.toISOString().slice(0, 10);
  return { from, to };
}

export function rangeForFinancePeriodPreset(preset: FinancePeriodPreset): DateRangeFilter | null {
  if (preset === 'month') return financeMonthRange();
  if (preset === 'next7') return financeNext7DaysRange();
  return null;
}
