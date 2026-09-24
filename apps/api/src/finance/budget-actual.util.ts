import type { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { dec } from './finance-title-utils';

export function monthRange(yearMonth: string): { from: Date; to: Date } {
  const [y, m] = yearMonth.split('-').map(Number);
  return {
    from: new Date(y, m - 1, 1),
    to: new Date(y, m, 0, 23, 59, 59, 999),
  };
}

type PrismaClient = Awaited<ReturnType<TenantPrismaService['getClient']>>;

/** Realizado no mês: CP pagas + manutenção com a mesma conta contábil. */
export async function computeBudgetActual(
  prisma: PrismaClient,
  chartAccountId: string,
  from: Date,
  to: Date,
): Promise<number> {
  const payables = await prisma.accountPayable.findMany({
    where: { chartAccountId, paidAt: { gte: from, lte: to } },
  });
  let actual = payables.reduce((s, p) => s + dec(p.amountPaid), 0);

  const maintenance = await prisma.maintenanceRecord.findMany({
    where: {
      chartAccountId,
      performedAt: { gte: from, lte: to },
      cost: { not: null },
    },
  });
  actual += maintenance.reduce((s, r) => s + dec(r.cost ?? 0), 0);

  return Math.round(actual * 100) / 100;
}
