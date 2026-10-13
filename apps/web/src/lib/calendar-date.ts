export function formatPercentPtBR(value: number, fractionDigits = 2): string {
  return `${value.toLocaleString('pt-BR', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`;
}

/** Competência AAAA-MM a partir de timestamp ISO (mesmo critério UTC da folha). */
export function yearMonthFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

export function currentYearMonthLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const BUSINESS_TZ = 'America/Sao_Paulo';

/** Dia civil YYYY-MM-DD de @db.Date (meia-noite UTC na API). */
export function prismaDateDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function businessTodayDayKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(now);
}

export function dayKeysDiff(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T12:00:00.000Z`).getTime();
  const b = new Date(`${toKey}T12:00:00.000Z`).getTime();
  return Math.round((b - a) / 86400000);
}

/** Formata datas de “dia de negócio” (armazenadas em UTC meia-noite) sem deslocar fuso. */
export function formatCalendarDatePtBR(iso: string): string {
  const key = prismaDateDayKey(iso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return iso;
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}
