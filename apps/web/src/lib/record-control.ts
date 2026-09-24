/** Número de controle do registro (ex.: títulos financeiros, produtos). */
export function formatRecordControl(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return String(Math.trunc(value));
}

export function recordControlsFrom<T extends { controlNumber?: number | null }>(items: T[]): string[] {
  return items.map((item) => formatRecordControl(item.controlNumber));
}
