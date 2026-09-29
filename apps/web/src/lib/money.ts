const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valores monetários em Real (R$), padrão pt-BR em todo o sistema. */
export function formatBrl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return brlFormatter.format(value);
}

/** Alias semântico para telas e relatórios. */
export const formatMoney = formatBrl;

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
