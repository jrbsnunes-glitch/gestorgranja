import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { FinanceAlertSettingsService } from './finance-alert-settings.service';
import { dec, isPayableSettled, isReceivableSettled, parsePaymentTerms, titleBalance } from './finance-title-utils';

@Injectable()
export class FinanceCashImpactService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly alertSettings: FinanceAlertSettingsService,
  ) {}

  async purchaseQuoteImpact(user: JwtPayload, quoteId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const quote = await prisma.purchaseQuote.findUnique({
      where: { id: quoteId },
      include: { purchaseRequest: true },
    });
    if (!quote) throw new NotFoundException('Cotação não encontrada');

    const terms = parsePaymentTerms(quote.paymentTermsJson);
    const installments =
      terms.length > 0
        ? terms
        : [{ amount: dec(quote.totalAmount), dueDate: new Date().toISOString().slice(0, 10) }];

    const settings = await this.alertSettings.get(user);
    const projectedBase = await this.projectedCash(user);

    const totalImpact = installments.reduce((s, i) => s + i.amount, 0);
    const threshold = (dec(settings.purchaseImpactThresholdPct) / 100) * Math.max(projectedBase, 1);
    const highImpact = totalImpact >= threshold;

    return {
      quoteId,
      supplierName: quote.supplierName,
      totalAmount: dec(quote.totalAmount),
      installments,
      projectedCashBefore: projectedBase,
      totalImpact,
      highImpact,
      thresholdPct: dec(settings.purchaseImpactThresholdPct),
    };
  }

  private async projectedCash(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const [payables, receivables, banks] = await Promise.all([
      prisma.accountPayable.findMany(),
      prisma.accountReceivable.findMany(),
      prisma.bankAccount.findMany(),
    ]);
    let base = banks.reduce((s, b) => s + dec(b.balance), 0);
    for (const r of receivables) {
      if (!isReceivableSettled(r)) base += titleBalance(r.amount, r.amountPaid);
    }
    for (const p of payables) {
      if (!isPayableSettled(p)) base -= titleBalance(p.amount, p.amountPaid);
    }
    return base;
  }
}
