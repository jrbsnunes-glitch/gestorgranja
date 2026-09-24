import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashMovementType, CashSessionStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { dec, isPayableSettled, isReceivableSettled, parsePaymentTerms, titleBalance } from './finance-title-utils';

export type CashFlowQuery = {
  from?: string;
  to?: string;
  kind?: string;
  includePayables?: boolean;
  includeReceivables?: boolean;
  includePurchases?: boolean;
  includeBankBalance?: boolean;
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

@Injectable()
export class CashFlowService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: CashFlowQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = parseDay(query.from, 'start') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const to = parseDay(query.to, 'end') ?? new Date();

    const includePayables = query.includePayables !== false;
    const includeReceivables = query.includeReceivables !== false;
    const includePurchases = query.includePurchases !== false;
    const includeBankBalance = query.includeBankBalance !== false;

    type Row = { date: string; kind: string; description: string; inflow: number; outflow: number; projected: boolean };
    const rows: Row[] = [];

    const payables = await prisma.accountPayable.findMany();
    for (const p of payables) {
      const settled = isPayableSettled(p);
      const paidAt = p.paidAt;
      if (settled && paidAt && paidAt >= from && paidAt <= to) {
        rows.push({
          date: paidAt.toISOString().slice(0, 10),
          kind: 'CP paga',
          description: p.description,
          inflow: 0,
          outflow: dec(p.amountPaid),
          projected: false,
        });
      } else if (includePayables && !settled && p.dueDate >= from && p.dueDate <= to) {
        rows.push({
          date: p.dueDate.toISOString().slice(0, 10),
          kind: 'CP prevista',
          description: p.description,
          inflow: 0,
          outflow: titleBalance(p.amount, p.amountPaid),
          projected: true,
        });
      }
    }

    const receivables = await prisma.accountReceivable.findMany();
    for (const r of receivables) {
      const settled = isReceivableSettled(r);
      const receivedAt = r.receivedAt;
      if (settled && receivedAt && receivedAt >= from && receivedAt <= to) {
        rows.push({
          date: receivedAt.toISOString().slice(0, 10),
          kind: 'CR recebida',
          description: r.description,
          inflow: dec(r.amountPaid),
          outflow: 0,
          projected: false,
        });
      } else if (includeReceivables && !settled && r.dueDate >= from && r.dueDate <= to) {
        rows.push({
          date: r.dueDate.toISOString().slice(0, 10),
          kind: 'CR prevista',
          description: r.description,
          inflow: titleBalance(r.amount, r.amountPaid),
          outflow: 0,
          projected: true,
        });
      }
    }

    if (includePurchases) {
      const orders = await prisma.purchaseOrder.findMany({
        where: { financeApprovedAt: { not: null }, payablesGenerated: false },
      });
      for (const o of orders) {
        const terms = parsePaymentTerms(o.paymentTermsJson);
        for (const t of terms) {
          const d = new Date(t.dueDate + 'T12:00:00');
          if (d >= from && d <= to) {
            rows.push({
              date: t.dueDate,
              kind: 'Compra prevista',
              description: `Pedido ${o.orderNumber}`,
              inflow: 0,
              outflow: t.amount,
              projected: true,
            });
          }
        }
      }
    }

    const movements = await prisma.cashMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
      include: { session: true },
    });
    for (const m of movements) {
      if (m.session.status !== CashSessionStatus.RECONCILED && m.session.status !== CashSessionStatus.OPEN) continue;
      const amt = dec(m.amount);
      rows.push({
        date: m.createdAt.toISOString().slice(0, 10),
        kind: 'Caixa',
        description: m.reason ?? m.type,
        inflow: m.type === CashMovementType.IN ? amt : 0,
        outflow: m.type === CashMovementType.OUT ? amt : 0,
        projected: false,
      });
    }

    const kindFilter = query.kind?.trim();
    const filtered = kindFilter ? rows.filter((r) => r.kind === kindFilter) : rows;
    filtered.sort((a, b) => a.date.localeCompare(b.date));

    let opening = 0;
    if (includeBankBalance) {
      const banks = await prisma.bankAccount.findMany();
      opening = banks.reduce((s, b) => s + dec(b.balance), 0);
    }

    let running = opening;
    const daily = filtered.map((r) => {
      running += r.inflow - r.outflow;
      return { ...r, balance: Math.round(running * 100) / 100 };
    });

    const totals = daily.reduce(
      (acc, r) => ({
        inflow: Math.round((acc.inflow + r.inflow) * 100) / 100,
        outflow: Math.round((acc.outflow + r.outflow) * 100) / 100,
      }),
      { inflow: 0, outflow: 0 },
    );

    return {
      period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
      kindFilter: kindFilter || null,
      openingBalance: opening,
      closingBalance: running,
      totals,
      rows: daily,
    };
  }
}
