const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** Valores monetários em Real (R$), padrão pt-BR em todo o sistema. */
export function formatBrl(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return brlFormatter.format(value);
}

/** Alias semântico para telas e relatórios. */
export const formatMoney = formatBrl;

/** Número a partir de "1.234,56", "1234,56", "R$ 10,00" ou "10.50". */
export function parseBrlMoney(raw: string): number {
  let t = raw.trim().replace(/\s/g, '').replace(/^R\$\s?/i, '');
  if (!t || t === ',' || t === '.') return NaN;
  if (t.includes(',')) {
    t = t.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
    t = t.replace(/\./g, '');
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/** Valor sem o símbolo, no padrão 1.234,56. */
export function formatBrlPlain(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
