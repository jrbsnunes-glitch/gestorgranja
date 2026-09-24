import { Injectable } from '@nestjs/common';
import { chartAccountAllowedForStock } from '../finance/chart-account-flow';
import { ChartAccountType } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class ProductionCostReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async byLot(tenantSlug: string, flockLotId: string, from?: Date, to?: Date) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const accounts = await prisma.chartAccount.findMany({ where: { isActive: true } });
    const stockAccountIds = accounts
      .filter((a) => chartAccountAllowedForStock(a.code, a.type as ChartAccountType))
      .map((a) => a.id);
    const costAccountIds = accounts.filter((a) => a.code === '4.2' || a.code.startsWith('4.2.')).map((a) => a.id);

    const moves = await prisma.stockMovement.findMany({
      where: {
        chartAccountId: stockAccountIds.length ? { in: stockAccountIds } : undefined,
        movedAt: from || to ? { gte: from, lte: to } : undefined,
      },
      include: { product: true },
    });
    let feedCost = 0;
    let medCost = 0;
    for (const m of moves) {
      const q = Number(m.quantity);
      const cost = Number(m.unitCost ?? 0) * q;
      if (m.product.type === 'FEED') feedCost += cost;
      if (m.product.type === 'MEDICATION') medCost += cost;
    }
    const payables =
      costAccountIds.length > 0
        ? await prisma.accountPayable.findMany({
            where: {
              chartAccountId: { in: costAccountIds },
              dueDate: from || to ? { gte: from, lte: to } : undefined,
            },
          })
        : [];
    const allocatedPayables = payables.reduce((s, p) => s + Number(p.amount), 0);
    return {
      flockLotId,
      feedCost,
      medCost,
      allocatedPayables,
      totalEstimated: feedCost + medCost + allocatedPayables,
    };
  }
}
