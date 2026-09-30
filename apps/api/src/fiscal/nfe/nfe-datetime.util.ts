/** Fuso horário do emitente para dhEmi / dhEvento (sem horário de verão). */
export function nfeUtcOffsetForUf(uf: string): string {
  const u = (uf || 'AM').trim().toUpperCase();
  if (u === 'AC') return '-05:00';
  if (u === 'AM' || u === 'RR' || u === 'RO' || u === 'MT' || u === 'MS') return '-04:00';
  return '-03:00';
}

function offsetToMinutes(offset: string): number {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!m) return -240;
  const sign = m[1] === '+' ? 1 : -1;
  return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
}

/** Data/hora NF-e no fuso do emitente (ex.: 2026-09-29T20:39:00-04:00). */
export function formatNfeDateTime(dt: Date, uf = 'AM'): string {
  const offset = nfeUtcOffsetForUf(uf);
  const shifted = new Date(dt.getTime() + offsetToMinutes(offset) * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}` +
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}${offset}`
  );
}

/** AAMM da chave de acesso, alinhado ao dhEmi no fuso do emitente. */
export function nfeYearMonthForAccessKey(dt: Date, uf = 'AM'): string {
  const offset = nfeUtcOffsetForUf(uf);
  const shifted = new Date(dt.getTime() + offsetToMinutes(offset) * 60 * 1000);
  return String(shifted.getUTCFullYear()).slice(2) + String(shifted.getUTCMonth() + 1).padStart(2, '0');
}
