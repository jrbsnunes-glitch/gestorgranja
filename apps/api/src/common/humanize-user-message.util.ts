const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

export const SYNC_OPERATION_LABELS: Record<string, string> = {
  dailyEggProduction: 'Postura diária',
  dailyMortality: 'Mortalidade diária',
  dailyFeedConsumption: 'Consumo de ração',
};

function formatDatePt(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

function payloadDateHint(payload: Record<string, unknown>): string {
  const raw = payload.date ?? payload.recordedAt ?? payload.consumedAt;
  if (typeof raw !== 'string') return '';
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return '';
  return ` (${formatDatePt(day)})`;
}

function shortError(msg: string): string {
  const cleaned = humanizeUserMessage(msg);
  if (cleaned.length > 120) return `${cleaned.slice(0, 117)}…`;
  return cleaned;
}

/** Mensagem amigável ao criar alerta de conflito de sync. */
export function formatSyncConflictMessage(
  type: string,
  payload: Record<string, unknown>,
  err: unknown,
): string {
  const kind = SYNC_OPERATION_LABELS[type] ?? 'Lançamento de campo';
  const when = payloadDateHint(payload);
  let detail = '';
  if (err instanceof Error && err.message.trim()) {
    const m = shortError(err.message);
    if (m && !UUID_RE.test(m)) detail = `: ${m}`;
  }
  return `${kind}${when} não pôde ser sincronizado${detail}. Revise em Administração → Conflitos de sync.`;
}

/** Remove ou substitui UUIDs e padrões técnicos em textos já gravados. */
export function humanizeUserMessage(text: string): string {
  if (!text?.trim()) return text ?? '';

  let msg = text.trim();

  msg = msg.replace(
    /Operação\s+[0-9a-f-]{36}\s+requer revisão\.?/gi,
    'Dados do aplicativo de campo precisam de revisão. Acesse Administração → Conflitos de sync.',
  );

  msg = msg.replace(
    /Operação\s+[0-9a-f-]{36}/gi,
    'Lançamento de campo',
  );

  msg = msg.replace(UUID_RE, '');

  msg = msg.replace(/\(\s*\)/g, '');
  msg = msg.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();

  return msg || 'Revise os detalhes no menu indicado ou contate o suporte.';
}
