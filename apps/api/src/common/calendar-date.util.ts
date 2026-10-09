/** Calendário comercial (granja BR). */
export const DEFAULT_BUSINESS_TZ = 'America/Sao_Paulo';

/** Chave YYYY-MM-DD no fuso informado. */
export function calendarDayKeyInTz(date: Date, timeZone = DEFAULT_BUSINESS_TZ): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Valor @db.Date estável (meio-dia UTC evita mudar o dia ao serializar). */
export function prismaDateOnly(dayKey: string): Date {
  return new Date(`${dayKey}T12:00:00.000Z`);
}

export function monthDayKeysInTz(date: Date, timeZone = DEFAULT_BUSINESS_TZ): { from: string; to: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const from = `${year}-${month}-01`;
  const y = Number(year);
  const mNum = Number(month);
  const lastDay = new Date(y, mNum, 0).getDate();
  const to = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
  return { from, to };
}
