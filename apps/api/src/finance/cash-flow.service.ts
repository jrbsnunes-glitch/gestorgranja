import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashMovementType, CashSessionStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { dateKeyInRange, localDateKey } from './finance-date.util';
import {
  dec,
  isPayableSettled,
  isReceivableSettled,
  isTitleCancelled,
  parsePaymentTerms,
  titleBalance,
} from './finance-title-utils';

const CASH_FLOW_SESSION_STATUSES: CashSessionStatus[] = [
  CashSessionStatus.OPEN,
  CashSessionStatus.PENDING_RECONCILIATION,
  CashSessionStatus.RECONCILED,
];

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
      if (isTitleCancelled(p.approvalStatus)) continue;
      const settled = isPayableSettled(p);
      if (settled) {
        const when = p.paidAt ?? p.dueDate;
        if (dateKeyInRange(when, from, to)) {
          rows.push({
            date: localDateKey(when),
            kind: 'Contas a pagar pagas',
            description: p.description,
            inflow: 0,
            outflow: dec(p.amountPaid),
            projected: false,
          });
        }
      } else if (includePayables && dateKeyInRange(p.dueDate, from, to)) {
        rows.push({
          date: localDateKey(p.dueDate),
          kind: 'Contas a pagar previstas',
          description: p.description,
          inflow: 0,
          outflow: titleBalance(p.amount, p.amountPaid),
          projected: true,
        });
      }
    }

    const receivables = await prisma.accountReceivable.findMany();
    for (const r of receivables) {
      if (isTitleCancelled(r.approvalStatus)) continue;
      const settled = isReceivableSettled(r);
      if (settled) {
        const when = r.receivedAt ?? r.dueDate;
        if (dateKeyInRange(when, from, to)) {
          rows.push({
            date: localDateKey(when),
            kind: 'Contas a receber recebidas',
            description: r.description,
            inflow: dec(r.amountPaid),
            outflow: 0,
            projected: false,
          });
        }
      } else if (includeReceivables && dateKeyInRange(r.dueDate, from, to)) {
        rows.push({
          date: localDateKey(r.dueDate),
          kind: 'Contas a receber previstas',
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
          if (dateKeyInRange(d, from, to)) {
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
      where: {
        createdAt: { gte: from, lte: to },
        session: { status: { in: CASH_FLOW_SESSION_STATUSES } },
      },
    });
    for (const m of movements) {
      const amt = dec(m.amount);
      rows.push({
        date: localDateKey(m.createdAt),
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
      period: { from: localDateKey(from), to: localDateKey(to) },
      kindFilter: kindFilter || null,
      openingBalance: opening,
      closingBalance: running,
      totals,
      rows: daily,
    };
  }
}
