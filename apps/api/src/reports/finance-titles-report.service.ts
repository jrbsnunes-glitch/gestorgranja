import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { PaymentApprovalStatus, Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type FinanceTitleKind = 'payable' | 'receivable';

export type FinanceTitleBucket =
  | 'open'
  | 'settled'
  | 'partial_payment'
  | 'partial_open';

export type FinanceTitlesReportQuery = {
  kind: FinanceTitleKind;
  from?: string;
  to?: string;
  controlMin?: number;
  controlMax?: number;
  partnerId?: string;
  includeOpen?: boolean;
  includeSettled?: boolean;
  includePartialPayment?: boolean;
  includePartialOpen?: boolean;
};

function parseDay(raw: string | undefined, mode: 'start' | 'end'): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (mode === 'end') d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

export function classifyFinanceTitle(row: {
  amount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
  approvalStatus: PaymentApprovalStatus;
  paidAt?: Date | null;
  receivedAt?: Date | null;
}): FinanceTitleBucket[] {
  const amount = dec(row.amount);
  const paid = dec(row.amountPaid);
  const buckets: FinanceTitleBucket[] = [];
  const settled =
    row.approvalStatus === PaymentApprovalStatus.PAID ||
    row.paidAt != null ||
    row.receivedAt != null ||
    (amount > 0 && paid >= amount - 0.005);

  if (settled) buckets.push('settled');
  if (paid > 0 && paid < amount - 0.005) buckets.push('partial_open');
  if (paid > 0) buckets.push('partial_payment');
  if (!settled && paid <= 0.005) buckets.push('open');
  return buckets;
}

@Injectable()
export class FinanceTitlesReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: FinanceTitlesReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');

    const where: Prisma.AccountPayableWhereInput | Prisma.AccountReceivableWhereInput = {};
    if (from || to) {
      where.dueDate = {};
      if (from) (where.dueDate as Prisma.DateTimeFilter).gte = from;
      if (to) (where.dueDate as Prisma.DateTimeFilter).lte = to;
    }
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.controlMin != null || query.controlMax != null) {
      where.controlNumber = {};
      if (query.controlMin != null) (where.controlNumber as Prisma.IntFilter).gte = query.controlMin;
      if (query.controlMax != null) (where.controlNumber as Prisma.IntFilter).lte = query.controlMax;
    }

    const includeOpen = query.includeOpen !== false;
    const includeSettled = query.includeSettled !== false;
    const includePartialPayment = query.includePartialPayment !== false;
    const includePartialOpen = query.includePartialOpen !== false;

    const rows =
      query.kind === 'payable'
        ? await prisma.accountPayable.findMany({
            where: where as Prisma.AccountPayableWhereInput,
            include: { partner: true, chartAccount: true },
            orderBy: [{ controlNumber: 'asc' }],
          })
        : await prisma.accountReceivable.findMany({
            where: where as Prisma.AccountReceivableWhereInput,
            include: { partner: true, chartAccount: true },
            orderBy: [{ controlNumber: 'asc' }],
          });

    const filtered = rows.filter((row) => {
      const buckets = classifyFinanceTitle(row);
      if (buckets.includes('open') && includeOpen) return true;
      if (buckets.includes('settled') && includeSettled) return true;
      if (buckets.includes('partial_payment') && includePartialPayment) return true;
      if (buckets.includes('partial_open') && includePartialOpen) return true;
      return false;
    });

    return {
      kind: query.kind,
      period: { from: query.from ?? null, to: query.to ?? null },
      filters: {
        controlMin: query.controlMin ?? null,
        controlMax: query.controlMax ?? null,
        partnerId: query.partnerId ?? null,
        includeOpen,
        includeSettled,
        includePartialPayment,
        includePartialOpen,
      },
      rows: filtered.map((r) => ({
        controlNumber: r.controlNumber,
        description: r.description,
        partnerName: r.partner.name,
        dueDate: r.dueDate.toISOString().slice(0, 10),
        amount: dec(r.amount),
        amountPaid: dec(r.amountPaid),
        balance: dec(r.amount) - dec(r.amountPaid),
        status: r.approvalStatus,
        buckets: classifyFinanceTitle(r),
        chartAccount: `${r.chartAccount.code} — ${r.chartAccount.name}`,
      })),
    };
  }
}
