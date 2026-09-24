import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class FinanceAlertSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async get(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    let row = await prisma.financeAlertSettings.findUnique({ where: { id: 'default' } });
    if (!row) {
      row = await prisma.financeAlertSettings.create({ data: { id: 'default' } });
    }
    return row;
  }

  async update(
    user: JwtPayload,
    data: {
      minCashBalance?: number;
      enableReceivableOverdue?: boolean;
      enablePaymentDue?: boolean;
      enableBudgetPace?: boolean;
      enablePurchaseImpact?: boolean;
      purchaseImpactThresholdPct?: number;
      budgetPaceWarningPct?: number;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    await this.get(user);
    return prisma.financeAlertSettings.update({
      where: { id: 'default' },
      data,
    });
  }
}
