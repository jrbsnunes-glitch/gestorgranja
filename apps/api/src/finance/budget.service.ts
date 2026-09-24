import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { computeBudgetActual, monthRange } from './budget-actual.util';
import { dec } from './finance-title-utils';

export type BudgetLineProgress = {
  id: string;
  yearMonth: string;
  amountPlanned: number;
  actual: number;
  usedPct: number | null;
  remaining: number;
  chartAccount: { id: string; code: string; name: string };
};

@Injectable()
export class BudgetService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  list(user: JwtPayload, yearMonth?: string) {
    const prisma = this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.then((p) =>
      p.budgetLine.findMany({
        where: yearMonth ? { yearMonth } : undefined,
        include: { chartAccount: true },
        orderBy: [{ yearMonth: 'desc' }, { chartAccount: { code: 'asc' } }],
      }),
    );
  }

  async listWithProgress(user: JwtPayload, yearMonth?: string): Promise<BudgetLineProgress[]> {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lines = await prisma.budgetLine.findMany({
      where: yearMonth ? { yearMonth } : undefined,
      include: { chartAccount: true },
      orderBy: [{ yearMonth: 'desc' }, { chartAccount: { code: 'asc' } }],
    });

    const out: BudgetLineProgress[] = [];
    for (const line of lines) {
      const { from, to } = monthRange(line.yearMonth);
      const actual = await computeBudgetActual(prisma, line.chartAccountId, from, to);
      const planned = dec(line.amountPlanned);
      const usedPct = planned > 0 ? Math.round((actual / planned) * 1000) / 10 : null;
      out.push({
        id: line.id,
        yearMonth: line.yearMonth,
        amountPlanned: planned,
        actual,
        usedPct,
        remaining: Math.round((planned - actual) * 100) / 100,
        chartAccount: {
          id: line.chartAccount.id,
          code: line.chartAccount.code,
          name: line.chartAccount.name,
        },
      });
    }
    return out;
  }

  async upsert(
    user: JwtPayload,
    data: { yearMonth: string; chartAccountId: string; amountPlanned: number },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const existing = await prisma.budgetLine.findFirst({
      where: { yearMonth: data.yearMonth, chartAccountId: data.chartAccountId },
    });
    if (existing) {
      return prisma.budgetLine.update({
        where: { id: existing.id },
        data: { amountPlanned: data.amountPlanned },
        include: { chartAccount: true },
      });
    }
    return prisma.budgetLine.create({
      data,
      include: { chartAccount: true },
    });
  }

  async actualForMonth(user: JwtPayload, yearMonth: string, chartAccountId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const { from, to } = monthRange(yearMonth);
    const actual = await computeBudgetActual(prisma, chartAccountId, from, to);
    return { yearMonth, chartAccountId, actual };
  }
}
