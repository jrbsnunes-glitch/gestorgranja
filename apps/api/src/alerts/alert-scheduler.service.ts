import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TenantProvisioningStatus } from '../generated/central-client';
import { AlertStatus, AlertType, PaymentApprovalStatus } from '../generated/tenant-client';
import { CentralPrismaService } from '../prisma/central-prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { computeBudgetActual } from '../finance/budget-actual.util';
import { dec, daysOverdue, isPayableSettled, isReceivableSettled, titleBalance } from '../finance/finance-title-utils';
import { RecurringFinanceService } from '../finance/recurring-finance.service';

@Injectable()
export class AlertSchedulerService {
  private readonly logger = new Logger(AlertSchedulerService.name);

  constructor(
    private readonly central: CentralPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly recurringFinance: RecurringFinanceService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async scanAllTenants() {
    const tenants = await this.central.tenant.findMany({
      where: { provisioningStatus: TenantProvisioningStatus.READY },
      select: { slug: true },
    });
    for (const t of tenants) {
      try {
        await this.scanTenant(t.slug);
      } catch (e) {
        this.logger.warn(`Alert scan failed for ${t.slug}: ${(e as Error).message}`);
      }
    }
  }

  async scanTenant(tenantSlug: string) {
    try {
      await this.recurringFinance.generateForTenantSlug(tenantSlug);
    } catch (e) {
      this.logger.warn(`Recurring finance generation failed for ${tenantSlug}: ${(e as Error).message}`);
    }
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const in7days = new Date();
    in7days.setDate(in7days.getDate() + 7);

    const settings = await prisma.financeAlertSettings.findUnique({ where: { id: 'default' } });

    const payables = await prisma.accountPayable.findMany({
      where: {
        dueDate: { lte: in7days },
        approvalStatus: { not: PaymentApprovalStatus.PAID },
      },
    });
    for (const p of payables) {
      if (settings && !settings.enablePaymentDue) continue;
      const exists = await prisma.alert.findFirst({
        where: { type: AlertType.PAYMENT_DUE, referenceId: p.id, status: AlertStatus.OPEN },
      });
      if (!exists) {
        await prisma.alert.create({
          data: {
            type: AlertType.PAYMENT_DUE,
            title: 'Conta a pagar a vencer',
            message: `${p.description} — venc. ${p.dueDate.toISOString().slice(0, 10)}`,
            referenceId: p.id,
            dueAt: p.dueDate,
          },
        });
      }
    }

    const products = await prisma.product.findMany({ where: { minStockQty: { gt: 0 } } });
    for (const product of products) {
      const moves = await prisma.stockMovement.findMany({ where: { productId: product.id } });
      let balance = 0;
      for (const m of moves) {
        const q = Number(m.quantity);
        balance += m.type === 'OUT' ? -q : q;
      }
      if (balance < Number(product.minStockQty)) {
        const exists = await prisma.alert.findFirst({
          where: { type: AlertType.LOW_STOCK, referenceId: product.id, status: AlertStatus.OPEN },
        });
        if (!exists) {
          await prisma.alert.create({
            data: {
              type: AlertType.LOW_STOCK,
              title: 'Estoque abaixo do mínimo',
              message: `${product.name} (${product.sku}): saldo ${balance}, mín. ${product.minStockQty}`,
              referenceId: product.id,
            },
          });
        }
      }
    }

    await this.scanFinanceAlerts(prisma, settings);
  }

  private async scanFinanceAlerts(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    settings: Awaited<ReturnType<typeof prisma.financeAlertSettings.findUnique>>,
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const warnPct = dec(settings?.budgetPaceWarningPct ?? 85) / 100;

    if (!settings || settings.enableReceivableOverdue) {
      const receivables = await prisma.accountReceivable.findMany();
      for (const r of receivables) {
        if (isReceivableSettled(r)) continue;
        if (daysOverdue(r.dueDate, today) <= 0) continue;
        const exists = await prisma.alert.findFirst({
          where: { type: AlertType.RECEIVABLE_OVERDUE, referenceId: r.id, status: AlertStatus.OPEN },
        });
        if (!exists) {
          await prisma.alert.create({
            data: {
              type: AlertType.RECEIVABLE_OVERDUE,
              title: 'Conta a receber atrasada',
              message: `${r.description} — ${daysOverdue(r.dueDate, today)} dia(s) de atraso`,
              referenceId: r.id,
              dueAt: r.dueDate,
            },
          });
        }
      }
    }

    if (!settings || settings.enableBudgetPace) {
      const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
      const lines = await prisma.budgetLine.findMany({ where: { yearMonth: ym }, include: { chartAccount: true } });
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      const to = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      for (const line of lines) {
        const actual = await computeBudgetActual(prisma, line.chartAccountId, from, to);
        const planned = dec(line.amountPlanned);
        if (planned > 0 && actual / planned >= warnPct) {
          const exists = await prisma.alert.findFirst({
            where: { type: AlertType.BUDGET_PACE_WARNING, referenceId: line.id, status: AlertStatus.OPEN },
          });
          if (!exists) {
            await prisma.alert.create({
              data: {
                type: AlertType.BUDGET_PACE_WARNING,
                title: 'Orçamento próximo do limite',
                message: `${line.chartAccount.code} — ${Math.round((actual / planned) * 100)}% do orçamento (${ym})`,
                referenceId: line.id,
              },
            });
          }
        }
      }

      const projects = await prisma.constructionProject.findMany();
      for (const proj of projects) {
        const budget = dec(proj.budget);
        const spent = dec(proj.spent);
        if (budget > 0 && spent / budget >= warnPct) {
          const exists = await prisma.alert.findFirst({
            where: { type: AlertType.BUDGET_PACE_WARNING, referenceId: proj.id, status: AlertStatus.OPEN },
          });
          if (!exists) {
            await prisma.alert.create({
              data: {
                type: AlertType.BUDGET_PACE_WARNING,
                title: 'Obra — orçamento',
                message: `${proj.name}: ${Math.round((spent / budget) * 100)}% do orçamento`,
                referenceId: proj.id,
              },
            });
          }
        }
      }
    }

    if (!settings || settings.enablePurchaseImpact) {
      const minCash = dec(settings?.minCashBalance ?? 0);
      if (minCash > 0) {
        const banks = await prisma.bankAccount.findMany();
        let projected = banks.reduce((s, b) => s + dec(b.balance), 0);
        const receivables = await prisma.accountReceivable.findMany();
        for (const r of receivables) {
          if (!isReceivableSettled(r)) projected += titleBalance(r.amount, r.amountPaid);
        }
        const payables = await prisma.accountPayable.findMany();
        for (const p of payables) {
          if (!isPayableSettled(p)) projected -= titleBalance(p.amount, p.amountPaid);
        }
        if (projected < minCash) {
          const exists = await prisma.alert.findFirst({
            where: { type: AlertType.CASH_PROJECTION_BELOW_LIMIT, status: AlertStatus.OPEN },
          });
          if (!exists) {
            await prisma.alert.create({
              data: {
                type: AlertType.CASH_PROJECTION_BELOW_LIMIT,
                title: 'Caixa projetado abaixo do limite',
                message: `Saldo projetado R$ ${projected.toFixed(2)} — limite R$ ${minCash.toFixed(2)}`,
              },
            });
          }
        }
      }
    }
  }
}
