import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  AccountPayable,
  AccountReceivable,
  AlertStatus,
  AlertType,
  CashSessionStatus,
  Partner,
} from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { humanizeUserMessage } from '../common/humanize-user-message.util';
import { BudgetService } from './budget.service';
import { daysOverdue, dec, isPayableSettled, isReceivableSettled, titleBalance } from './finance-title-utils';

const FINANCE_ALERT_TYPES: AlertType[] = [
  AlertType.PAYMENT_DUE,
  AlertType.RECEIVABLE_OVERDUE,
  AlertType.CASH_PROJECTION_BELOW_LIMIT,
  AlertType.BUDGET_PACE_WARNING,
  AlertType.PURCHASE_CASH_IMPACT,
];

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type DailyFlowPoint = {
  date: string;
  entradas: number;
  saidas: number;
  crAVencer: number;
  cpAVencer: number;
};

@Injectable()
export class FinanceDashboardService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly budget: BudgetService,
  ) {}

  async dashboard(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const [payables, receivables, alerts, bankAccounts, reconciledSessions] = await Promise.all([
      prisma.accountPayable.findMany({ include: { partner: true } }),
      prisma.accountReceivable.findMany({ include: { partner: true } }),
      prisma.alert.findMany({
        where: { status: AlertStatus.OPEN, type: { in: FINANCE_ALERT_TYPES } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      prisma.bankAccount.findMany(),
      prisma.cashRegisterSession.findMany({
        where: { status: CashSessionStatus.RECONCILED },
        take: 20,
        orderBy: { closedAt: 'desc' },
      }),
    ]);

    let cpOpen = 0;
    let cpOverdue = 0;
    let cpDue7 = 0;
    let cpDue30 = 0;
    for (const p of payables) {
      if (isPayableSettled(p)) continue;
      const bal = titleBalance(p.amount, p.amountPaid);
      cpOpen += bal;
      if (daysOverdue(p.dueDate, today) > 0) cpOverdue += bal;
      if (p.dueDate <= in7) cpDue7 += bal;
      if (p.dueDate <= in30) cpDue30 += bal;
    }

    let crOpen = 0;
    let crOverdue = 0;
    let crDue7 = 0;
    let crDue30 = 0;
    const byPartner = new Map<string, { name: string; open: number }>();
    for (const r of receivables) {
      if (isReceivableSettled(r)) continue;
      const bal = titleBalance(r.amount, r.amountPaid);
      crOpen += bal;
      if (daysOverdue(r.dueDate, today) > 0) crOverdue += bal;
      if (r.dueDate <= in7) crDue7 += bal;
      if (r.dueDate <= in30) crDue30 += bal;
      const cur = byPartner.get(r.partnerId) ?? { name: r.partner.name, open: 0 };
      cur.open += bal;
      byPartner.set(r.partnerId, cur);
    }

    const topClients = [...byPartner.entries()]
      .map(([partnerId, v]) => ({
        partnerId,
        partnerName: v.name,
        openBalance: v.open,
        sharePct: crOpen > 0 ? (v.open / crOpen) * 100 : 0,
      }))
      .sort((a, b) => b.openBalance - a.openBalance)
      .slice(0, 5);

    let cashBase = bankAccounts.reduce((s, b) => s + dec(b.balance), 0);
    if (reconciledSessions[0]?.closingBalance != null) {
      cashBase += dec(reconciledSessions[0].closingBalance);
    }

    const dailyFlow = this.buildDailyFlow(today, payables, receivables);

    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const budgetProgress = await this.budget.listWithProgress(user, ym);

    return {
      payables: { open: cpOpen, overdue: cpOverdue, dueNext7: cpDue7, dueNext30: cpDue30 },
      receivables: { open: crOpen, overdue: crOverdue, dueNext7: crDue7, dueNext30: crDue30 },
      topClients,
      alerts: alerts.map((a) => ({ ...a, message: humanizeUserMessage(a.message) })),
      cashBase,
      dailyFlow,
      budgetYearMonth: ym,
      budgetProgress,
    };
  }

  private buildDailyFlow(
    today: Date,
    payables: (AccountPayable & { partner: Partner })[],
    receivables: (AccountReceivable & { partner: Partner })[],
  ): DailyFlowPoint[] {
    const daysBack = 7;
    const daysForward = 30;
    const map = new Map<string, DailyFlowPoint>();

    const ensure = (date: string): DailyFlowPoint => {
      let row = map.get(date);
      if (!row) {
        row = { date, entradas: 0, saidas: 0, crAVencer: 0, cpAVencer: 0 };
        map.set(date, row);
      }
      return row;
    };

    for (let i = -daysBack; i <= daysForward; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      ensure(localDateKey(d));
    }

    for (const p of payables) {
      const dueKey = localDateKey(p.dueDate);
      if (map.has(dueKey) && !isPayableSettled(p)) {
        ensure(dueKey).cpAVencer += titleBalance(p.amount, p.amountPaid);
      }
      if (isPayableSettled(p) && p.paidAt) {
        const paidKey = localDateKey(p.paidAt);
        if (map.has(paidKey)) {
          ensure(paidKey).saidas += dec(p.amountPaid);
        }
      }
    }

    for (const r of receivables) {
      const dueKey = localDateKey(r.dueDate);
      if (map.has(dueKey) && !isReceivableSettled(r)) {
        ensure(dueKey).crAVencer += titleBalance(r.amount, r.amountPaid);
      }
      if (isReceivableSettled(r) && r.receivedAt) {
        const recvKey = localDateKey(r.receivedAt);
        if (map.has(recvKey)) {
          ensure(recvKey).entradas += dec(r.amountPaid);
        }
      }
    }

    for (const row of map.values()) {
      row.entradas = Math.round(row.entradas * 100) / 100;
      row.saidas = Math.round(row.saidas * 100) / 100;
      row.crAVencer = Math.round(row.crAVencer * 100) / 100;
      row.cpAVencer = Math.round(row.cpAVencer * 100) / 100;
    }

    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }
}
