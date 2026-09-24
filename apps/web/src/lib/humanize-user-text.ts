const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** Texto legível para o usuário, sem códigos UUID soltos. */
export function humanizeUserText(text: string): string {
  if (!text?.trim()) return text ?? '';

  let msg = text.trim();

  msg = msg.replace(
    /Operação\s+[0-9a-f-]{36}\s+requer revisão\.?/gi,
    'Dados do aplicativo de campo precisam de revisão. Acesse Administração → Conflitos de sync.',
  );

  msg = msg.replace(/Operação\s+[0-9a-f-]{36}/gi, 'Lançamento de campo');
  msg = msg.replace(UUID_RE, '');
  msg = msg.replace(/\(\s*\)/g, '');
  msg = msg.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();

  return msg || 'Consulte o menu indicado ou contate o suporte.';
}
