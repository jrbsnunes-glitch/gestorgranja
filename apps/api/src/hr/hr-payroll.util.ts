/** Utilitários de competência (AAAA-MM) e dias corridos inclusivos. */
export function compareYearMonth(a: string, b: string): number {
  return a.localeCompare(b);
}

export function yearMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthBounds(yearMonth: string): { start: Date; end: Date } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
}

export function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end = Math.min(aEnd.getTime(), bEnd.getTime());
  if (end < start) return 0;
  return Math.floor((end - start) / 86400000) + 1;
}

export function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function shiftExpectedMinutes(startTime: string, endTime: string, breakMinutes: number): number {
  let span = parseTimeToMinutes(endTime) - parseTimeToMinutes(startTime);
  if (span <= 0) span += 24 * 60;
  return Math.max(span - breakMinutes, 0);
}
