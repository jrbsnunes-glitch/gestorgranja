import { ChartAccountType } from '../generated/tenant-client';

/** Contas analíticas para classificação de contas a pagar (custos/despesas). */
export function chartAccountAllowedForPayable(code: string, type: ChartAccountType): boolean {
  const c = code.trim();
  if (!c) return false;
  if (type === 'REVENUE') return false;
  if (c === '6' || c.startsWith('6.')) return false;
  return type === 'EXPENSE' || c.startsWith('4') || c.startsWith('5') || c.startsWith('2');
}

/** Contas analíticas para contas a receber. */
export function chartAccountAllowedForReceivable(code: string, type: ChartAccountType): boolean {
  const c = code.trim();
  if (!c) return false;
  return type === 'REVENUE' || c === '6' || c.startsWith('6.');
}

/** Estoque / produção — ativo circulante (estoques) ou custos de produção. */
export function chartAccountAllowedForStock(code: string, type: ChartAccountType): boolean {
  const c = code.trim();
  if (!c) return false;
  if (c.startsWith('1.1.3') || c === '4.2' || c.startsWith('4.2.')) return true;
  return type === 'ASSET' && c.startsWith('1.1.3');
}
