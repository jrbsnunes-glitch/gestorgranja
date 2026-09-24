import { PrismaClient } from '../generated/tenant-client';

type Tx = Pick<PrismaClient, 'chartAccount'>;

/** Conta analítica padrão para movimentação de estoque (ovos embalados / estoques). */
export async function defaultStockChartAccountId(tx: Tx): Promise<string> {
  const preferred = await tx.chartAccount.findFirst({
    where: { code: '1.1.3.04', isActive: true, isPosting: true },
  });
  if (preferred) return preferred.id;
  const fallback = await tx.chartAccount.findFirst({
    where: { code: { startsWith: '1.1.3' }, isActive: true, isPosting: true },
    orderBy: { code: 'asc' },
  });
  if (fallback) return fallback.id;
  throw new Error('Plano de contas: configure uma conta de estoque (ex.: 1.1.3.04)');
}

/** Conta padrão para integração postura → estoque (embalagens). */
export async function defaultEggStockChartAccountId(tx: Tx): Promise<string> {
  const emb = await tx.chartAccount.findFirst({
    where: { code: '1.1.3.03', isActive: true, isPosting: true },
  });
  if (emb) return emb.id;
  return defaultStockChartAccountId(tx);
}
