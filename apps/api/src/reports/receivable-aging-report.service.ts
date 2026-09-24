import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { daysOverdue, isReceivableSettled, titleBalance } from '../finance/finance-title-utils';

@Injectable()
export class ReceivableAgingReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.accountReceivable.findMany({
      include: { partner: true },
      orderBy: { dueDate: 'asc' },
    });
    const today = new Date();
    const buckets = {
      current: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90plus: 0,
    };
    const details: {
      controlNumber: number;
      partnerName: string;
      dueDate: string;
      balance: number;
      bucket: string;
      overdueDays: number;
    }[] = [];

    for (const r of rows) {
      if (isReceivableSettled(r)) continue;
      const balance = titleBalance(r.amount, r.amountPaid);
      const od = daysOverdue(r.dueDate, today);
      let bucket = 'current';
      if (od === 0) {
        buckets.current += balance;
        bucket = 'A vencer';
      } else if (od <= 30) {
        buckets.d1_30 += balance;
        bucket = '1–30 dias';
      } else if (od <= 60) {
        buckets.d31_60 += balance;
        bucket = '31–60 dias';
      } else if (od <= 90) {
        buckets.d61_90 += balance;
        bucket = '61–90 dias';
      } else {
        buckets.d90plus += balance;
        bucket = '90+ dias';
      }
      details.push({
        controlNumber: r.controlNumber,
        partnerName: r.partner.name,
        dueDate: r.dueDate.toISOString().slice(0, 10),
        balance,
        bucket,
        overdueDays: od,
      });
    }

    return { buckets, rows: details, generatedAt: new Date().toISOString() };
  }
}
