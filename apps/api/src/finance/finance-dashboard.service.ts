import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  AccountPayable,
  AccountReceivable,
  AlertStatus,
  AlertType,
  CashMovementType,
  CashSessionStatus,
  Partner,
  Prisma,
} from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { humanizeUserMessage } from '../common/humanize-user-message.util';
import { BudgetService } from './budget.service';
import { localDateKey } from './finance-date.util';
import {
  daysOverdue,
  dec,
  isPayableSettled,
  isReceivableSettled,
  isTitleCancelled,
  titleBalance,
} from './finance-title-utils';

const FINANCE_ALERT_TYPES: AlertType[] = [
  AlertType.PAYMENT_DUE,
  AlertType.RECEIVABLE_OVERDUE,
  AlertType.CASH_PROJECTION_BELOW_LIMIT,
  AlertType.BUDGET_PACE_WARNING,
  AlertType.PURCHASE_CASH_IMPACT,
];

const DASHBOARD_CASH_SESSION_STATUSES: CashSessionStatus[] = [
  CashSessionStatus.OPEN,
  CashSessionStatus.PENDING_RECONCILIATION,
  CashSessionStatus.RECONCILED,
];

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
    const in3 = new Date(today);
    in3.setDate(in3.getDate() + 3);
    const in7 = new Date(today);
    in7.setDate(in7.getDate() + 7);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const flowHorizonEnd = new Date(today);
    flowHorizonEnd.setDate(flowHorizonEnd.getDate() + 30);
    flowHorizonEnd.setHours(23, 59, 59, 999);

    const [payables, receivables, alerts, bankAccounts, reconciledSessions, cashMovements] =
      await Promise.all([
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
      prisma.cashMovement.findMany({
        where: {
          createdAt: { gte: monthStart, lte: flowHorizonEnd },
          session: { status: { in: DASHBOARD_CASH_SESSION_STATUSES } },
        },
      }),
    ]);

    let cpOpen = 0;
    let cpOverdue = 0;
    let cpDue3 = 0;
    let cpDue7 = 0;
    let cpDue30 = 0;
    for (const p of payables) {
      if (isTitleCancelled(p.approvalStatus)) continue;
      if (isPayableSettled(p)) continue;
      const bal = titleBalance(p.amount, p.amountPaid);
      cpOpen += bal;
      if (daysOverdue(p.dueDate, today) > 0) cpOverdue += bal;
      if (p.dueDate <= in3) cpDue3 += bal;
      if (p.dueDate <= in7) cpDue7 += bal;
      if (p.dueDate <= in30) cpDue30 += bal;
    }

    let crOpen = 0;
    let crOverdue = 0;
    let crDueToday = 0;
    let crDue3 = 0;
    let crDue7 = 0;
    let crDue30 = 0;
    const byPartner = new Map<string, { name: string; open: number }>();
    for (const r of receivables) {
      if (isTitleCancelled(r.approvalStatus)) continue;
      if (isReceivableSettled(r)) continue;
      const bal = titleBalance(r.amount, r.amountPaid);
      crOpen += bal;
      if (daysOverdue(r.dueDate, today) > 0) crOverdue += bal;
      else if (localDateKey(r.dueDate) === localDateKey(today)) crDueToday += bal;
      if (r.dueDate <= in3) crDue3 += bal;
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

    const dailyFlow = this.buildDailyFlow(today, payables, receivables, cashMovements);

    const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const budgetProgress = await this.budget.listWithProgress(user, ym);

    return {
      payables: { open: cpOpen, overdue: cpOverdue, dueNext3: cpDue3, dueNext7: cpDue7, dueNext30: cpDue30 },
      receivables: {
        open: crOpen,
        overdue: crOverdue,
        dueToday: crDueToday,
        dueNext3: crDue3,
        dueNext7: crDue7,
        dueNext30: crDue30,
      },
      openAlertsCount: alerts.length,
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
    cashMovements: { type: CashMovementType; amount: Prisma.Decimal; createdAt: Date }[],
  ): DailyFlowPoint[] {
    const daysForward = 30;
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const map = new Map<string, DailyFlowPoint>();

    const ensure = (date: string): DailyFlowPoint => {
      let row = map.get(date);
      if (!row) {
        row = { date, entradas: 0, saidas: 0, crAVencer: 0, cpAVencer: 0 };
        map.set(date, row);
      }
      return row;
    };

    const lastChartDay = new Date(today);
    lastChartDay.setDate(lastChartDay.getDate() + daysForward);
    for (let d = new Date(monthStart); d <= lastChartDay; d.setDate(d.getDate() + 1)) {
      ensure(localDateKey(d));
    }

    for (const p of payables) {
      const dueKey = localDateKey(p.dueDate);
      if (map.has(dueKey) && !isPayableSettled(p)) {
        ensure(dueKey).cpAVencer += titleBalance(p.amount, p.amountPaid);
      }
      if (isPayableSettled(p)) {
        const paidKey = localDateKey(p.paidAt ?? p.dueDate);
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
      if (isReceivableSettled(r)) {
        const recvKey = localDateKey(r.receivedAt ?? r.dueDate);
        if (map.has(recvKey)) {
          ensure(recvKey).entradas += dec(r.amountPaid);
        }
      }
    }

    for (const m of cashMovements) {
      const key = localDateKey(m.createdAt);
      if (!map.has(key)) continue;
      const v = dec(m.amount);
      if (m.type === CashMovementType.IN) ensure(key).entradas += v;
      else ensure(key).saidas += v;
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
