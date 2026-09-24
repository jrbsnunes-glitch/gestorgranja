import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { PaymentApprovalStatus, RecurringFinanceKind } from '../generated/tenant-client';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

function dueDateForMonth(year: number, monthIndex: number, dayOfMonth: number): Date {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dayOfMonth), lastDay);
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function monthStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

@Injectable()
export class RecurringFinanceService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  list(user: JwtPayload, kind: RecurringFinanceKind) {
    return this.tenantPrisma.getClient(user.tenantSlug).then((p) =>
      p.recurringFinanceRule.findMany({
        where: { kind },
        include: { partner: true, chartAccount: true },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async create(
    user: JwtPayload,
    data: {
      kind: RecurringFinanceKind;
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: number;
      dayOfMonth: number;
      startDate: string;
      endDate: string;
    },
  ) {
    if (data.amount <= 0) throw new BadRequestException('Valor inválido');
    if (data.dayOfMonth < 1 || data.dayOfMonth > 28) {
      throw new BadRequestException('Dia do vencimento deve ser entre 1 e 28');
    }
    const start = new Date(data.startDate + 'T12:00:00');
    const end = new Date(data.endDate + 'T12:00:00');
    if (end < start) throw new BadRequestException('Fim do período deve ser após o início');

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rule = await prisma.recurringFinanceRule.create({
      data: {
        kind: data.kind,
        partnerId: data.partnerId,
        chartAccountId: data.chartAccountId,
        description: data.description,
        amount: data.amount,
        dayOfMonth: data.dayOfMonth,
        startDate: start,
        endDate: end,
      },
      include: { partner: true, chartAccount: true },
    });
    await this.generateForRule(prisma, rule.id, addMonths(new Date(), 3));
    return rule;
  }

  async setActive(user: JwtPayload, id: string, isActive: boolean) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.recurringFinanceRule.update({
      where: { id },
      data: { isActive },
      include: { partner: true, chartAccount: true },
    });
  }

  async ensureGenerated(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    await this.generateAllActive(prisma, addMonths(new Date(), 3));
  }

  async generateForTenantSlug(tenantSlug: string) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    await this.generateAllActive(prisma, addMonths(new Date(), 3));
  }

  private async generateAllActive(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    horizon: Date,
  ) {
    const rules = await prisma.recurringFinanceRule.findMany({ where: { isActive: true } });
    for (const r of rules) {
      await this.generateForRule(prisma, r.id, horizon);
    }
  }

  private async generateForRule(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    ruleId: string,
    horizon: Date,
  ) {
    const rule = await prisma.recurringFinanceRule.findUnique({ where: { id: ruleId } });
    if (!rule || !rule.isActive) return;

    const start = monthStart(rule.startDate);
    const end = monthStart(rule.endDate);
    const limit = monthStart(horizon < rule.endDate ? horizon : rule.endDate);

    let cursor = new Date(start);
    while (cursor <= limit) {
      const due = dueDateForMonth(cursor.getFullYear(), cursor.getMonth(), rule.dayOfMonth);
      if (due > rule.endDate) break;
      await this.ensureTitleForDue(prisma, rule, due);
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  private async ensureTitleForDue(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    rule: {
      id: string;
      kind: RecurringFinanceKind;
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: Prisma.Decimal;
    },
    due: Date,
  ) {
    const dayKey = due.toISOString().slice(0, 10);
    if (rule.kind === RecurringFinanceKind.PAYABLE) {
      const exists = await prisma.accountPayable.findFirst({
        where: { recurringRuleId: rule.id, dueDate: due },
      });
      if (exists) return;
      const max = await prisma.accountPayable.aggregate({ _max: { controlNumber: true } });
      const controlNumber = (max._max.controlNumber ?? 0) + 1;
      await prisma.accountPayable.create({
        data: {
          controlNumber,
          partnerId: rule.partnerId,
          chartAccountId: rule.chartAccountId,
          description: `${rule.description} (${dayKey.slice(0, 7)})`,
          amount: rule.amount,
          dueDate: due,
          approvalStatus: PaymentApprovalStatus.PENDING,
          recurringRuleId: rule.id,
        },
      });
    } else {
      const exists = await prisma.accountReceivable.findFirst({
        where: { recurringRuleId: rule.id, dueDate: due },
      });
      if (exists) return;
      const max = await prisma.accountReceivable.aggregate({ _max: { controlNumber: true } });
      const controlNumber = (max._max.controlNumber ?? 0) + 1;
      await prisma.accountReceivable.create({
        data: {
          controlNumber,
          partnerId: rule.partnerId,
          chartAccountId: rule.chartAccountId,
          description: `${rule.description} (${dayKey.slice(0, 7)})`,
          amount: rule.amount,
          dueDate: due,
          approvalStatus: PaymentApprovalStatus.PENDING,
          recurringRuleId: rule.id,
        },
      });
    }
  }
}

function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}
