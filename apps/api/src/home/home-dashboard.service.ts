import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashService } from '../cash/cash.service';
import { CommercialService } from '../commercial/commercial.service';
import { FinanceDashboardService } from '../finance/finance-dashboard.service';
import { InventoryService } from '../inventory/inventory.service';
import { OperationDashboardService } from '../operation/operation-dashboard.service';
import { EggProductionStockService } from '../production/egg-production-stock.service';

function hasPerm(user: JwtPayload, codes: string[]) {
  if (user.permissions.includes('*')) return true;
  return codes.some((c) => user.permissions.includes(c));
}

function isoDaysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class HomeDashboardService {
  constructor(
    private readonly operationDashboard: OperationDashboardService,
    private readonly financeDashboard: FinanceDashboardService,
    private readonly cash: CashService,
    private readonly commercial: CommercialService,
    private readonly inventory: InventoryService,
    private readonly eggStock: EggProductionStockService,
  ) {}

  async build(user: JwtPayload) {
    const zootecPerm = hasPerm(user, [
      'production.read',
      'production.write',
      'production.review',
      'reports.read',
    ]);
    const financePerm = hasPerm(user, ['finance.write', 'cash.read', 'cash.write', 'cash.reconcile']);
    const productsPerm = hasPerm(user, ['inventory.write', 'purchasing.write', 'cadastros.read']);
    const salesPerm = hasPerm(user, ['sales.read', 'sales.write']);

    const result: {
      zootec?: Awaited<ReturnType<HomeDashboardService['loadZootec']>>;
      finance?: Awaited<ReturnType<HomeDashboardService['loadFinance']>>;
      cash?: Awaited<ReturnType<HomeDashboardService['loadCash']>>;
      products?: Awaited<ReturnType<HomeDashboardService['loadProducts']>>;
    } = {};

    const tasks: Promise<void>[] = [];
    if (zootecPerm) {
      tasks.push(this.loadZootec(user).then((v) => { result.zootec = v; }));
    }
    if (financePerm) {
      tasks.push(this.loadFinance(user).then((v) => { result.finance = v; }));
    }
    if (financePerm || salesPerm) {
      tasks.push(this.loadCash(user).then((v) => { result.cash = v; }));
    }
    if (productsPerm) {
      tasks.push(this.loadProducts(user).then((v) => { result.products = v; }));
    }
    await Promise.all(tasks);

    return result;
  }

  private async loadZootec(user: JwtPayload) {
    const from = isoDaysAgo(29);
    const to = isoDaysAgo(0);
    const dash = await this.operationDashboard.build(user, { from, to });
    return {
      lots: dash.totals.lots,
      liveBirds: dash.totals.liveBirds,
      layRatePct: dash.totals.layRatePct,
      awaitingReview: dash.totals.awaitingReview,
      openOccurrences: dash.totals.openOccurrences,
      criticalOccurrences: dash.totals.criticalOccurrences,
    };
  }

  private async loadFinance(user: JwtPayload) {
    const dash = await this.financeDashboard.dashboard(user);
    return {
      payables: {
        dueNext3: dash.payables.dueNext3,
        overdue: dash.payables.overdue,
      },
      receivables: {
        dueToday: dash.receivables.dueToday,
        dueNext3: dash.receivables.dueNext3,
        overdue: dash.receivables.overdue,
      },
      cashBase: dash.cashBase,
      openAlertsCount: dash.openAlertsCount ?? dash.alerts.length,
    };
  }

  private async loadCash(user: JwtPayload) {
    const [counts, sales] = await Promise.all([
      this.cash.countSessionsByStatus(user),
      this.commercial.getSalesStats(user).catch(() => ({
        day: { count: 0, totalAmount: 0 },
        month: { count: 0, totalAmount: 0 },
      })),
    ]);
    return { ...counts, salesDay: sales.day, salesMonth: sales.month };
  }

  private async loadProducts(user: JwtPayload) {
    const [inv, eggs] = await Promise.all([
      this.inventory.dashboard(user),
      this.eggStock.inventorySnapshot(user.tenantSlug).catch(() => null),
    ]);
    return {
      criticalCount: inv.criticalCount,
      topOut30d: inv.topOut30d.slice(0, 3),
      eggInventory: eggs,
    };
  }
}
