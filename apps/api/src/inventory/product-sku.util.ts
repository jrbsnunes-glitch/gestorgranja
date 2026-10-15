import { randomUUID } from 'crypto';

/** SKU informado pelo usuário ou gerado a partir do controle interno. */
export function resolveProductSkuInput(raw?: string | null): string | null {
  const t = raw?.trim();
  return t ? t.toUpperCase() : null;
}

export function temporaryProductSku() {
  return `TMP-${randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

export function productSkuFromControlNumber(controlNumber: number) {
  return `P${String(controlNumber).padStart(6, '0')}`;
}
