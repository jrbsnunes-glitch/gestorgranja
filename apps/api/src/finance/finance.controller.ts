import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audited } from '../audit/audit.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { BankAccountService } from './bank-account.service';
import { BudgetService } from './budget.service';
import { CashFlowService } from './cash-flow.service';
import { FinanceAlertSettingsService } from './finance-alert-settings.service';
import { FinanceCashImpactService } from './finance-cash-impact.service';
import { FinanceDashboardService } from './finance-dashboard.service';
import { FinanceService } from './finance.service';
import { RecurringFinanceKind } from '../generated/tenant-client';
import { RecurringFinanceService } from './recurring-finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/finance')
export class FinanceController {
  constructor(
    private readonly finance: FinanceService,
    private readonly dashboard: FinanceDashboardService,
    private readonly cashFlow: CashFlowService,
    private readonly alertSettings: FinanceAlertSettingsService,
    private readonly cashImpact: FinanceCashImpactService,
    private readonly budget: BudgetService,
    private readonly banks: BankAccountService,
    private readonly recurring: RecurringFinanceService,
  ) {}

  @Get('recurring')
  @RequirePermissions('finance.write', '*')
  listRecurring(@CurrentUser() user: JwtPayload, @Query('kind') kind: 'PAYABLE' | 'RECEIVABLE') {
    const k = kind === 'RECEIVABLE' ? RecurringFinanceKind.RECEIVABLE : RecurringFinanceKind.PAYABLE;
    return this.recurring.list(user, k);
  }

  @Post('recurring')
  @RequirePermissions('finance.write', '*')
  createRecurring(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      kind: 'PAYABLE' | 'RECEIVABLE';
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: number;
      dayOfMonth: number;
      startDate: string;
      endDate: string;
    },
  ) {
    const kind =
      body.kind === 'RECEIVABLE' ? RecurringFinanceKind.RECEIVABLE : RecurringFinanceKind.PAYABLE;
    return this.recurring.create(user, { ...body, kind });
  }

  @Patch('recurring/:id/active')
  @RequirePermissions('finance.write', '*')
  setRecurringActive(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.recurring.setActive(user, id, body.isActive);
  }

  @Get('dashboard')
  @RequirePermissions('finance.write', 'reports.read', '*')
  getDashboard(@CurrentUser() user: JwtPayload) {
    return this.dashboard.dashboard(user);
  }

  @Get('open')
  @RequirePermissions('finance.write', '*')
  listOpen(@CurrentUser() user: JwtPayload) {
    return this.finance.listOpen(user);
  }

  @Get('receivables/detail')
  @RequirePermissions('finance.write', '*')
  receivablesDetail(@CurrentUser() user: JwtPayload) {
    return this.finance.listReceivablesDetail(user);
  }

  @Get('cash-flow')
  @RequirePermissions('finance.write', 'reports.read', '*')
  getCashFlow(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includePayables') includePayables?: string,
    @Query('includeReceivables') includeReceivables?: string,
    @Query('includePurchases') includePurchases?: string,
    @Query('includeBankBalance') includeBankBalance?: string,
    @Query('kind') kind?: string,
  ) {
    const bool = (v: string | undefined) => v !== '0' && v !== 'false';
    return this.cashFlow.report(user, {
      from,
      to,
      kind,
      includePayables: bool(includePayables),
      includeReceivables: bool(includeReceivables),
      includePurchases: bool(includePurchases),
      includeBankBalance: bool(includeBankBalance),
    });
  }

  @Get('alert-settings')
  @RequirePermissions('finance.write', '*')
  getAlertSettings(@CurrentUser() user: JwtPayload) {
    return this.alertSettings.get(user);
  }

  @Patch('alert-settings')
  @RequirePermissions('finance.write', '*')
  updateAlertSettings(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.alertSettings.update(user, body as Parameters<FinanceAlertSettingsService['update']>[1]);
  }

  @Get('cash-impact/purchase-quote/:quoteId')
  @RequirePermissions('finance.write', 'purchasing.write', '*')
  purchaseQuoteImpact(@CurrentUser() user: JwtPayload, @Param('quoteId') quoteId: string) {
    return this.cashImpact.purchaseQuoteImpact(user, quoteId);
  }

  @Get('budget-lines')
  @RequirePermissions('finance.write', '*')
  listBudget(
    @CurrentUser() user: JwtPayload,
    @Query('yearMonth') yearMonth?: string,
    @Query('withProgress') withProgress?: string,
  ) {
    if (withProgress === '1' || withProgress === 'true') {
      return this.budget.listWithProgress(user, yearMonth);
    }
    return this.budget.list(user, yearMonth);
  }

  @Post('budget-lines')
  @RequirePermissions('finance.write', '*')
  upsertBudget(
    @CurrentUser() user: JwtPayload,
    @Body() body: { yearMonth: string; chartAccountId: string; amountPlanned: number },
  ) {
    return this.budget.upsert(user, body);
  }

  @Get('bank-accounts')
  @RequirePermissions('finance.write', '*')
  listBanks(@CurrentUser() user: JwtPayload) {
    return this.banks.list(user);
  }

  @Post('bank-accounts')
  @RequirePermissions('finance.write', '*')
  createBank(
    @CurrentUser() user: JwtPayload,
    @Body() body: { bankName: string; agency: string; account: string; balance?: number; bankId?: string },
  ) {
    return this.banks.create(user, body);
  }

  @Patch('bank-accounts/:id/balance')
  @RequirePermissions('finance.write', '*')
  updateBankBalance(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { balance: number }) {
    return this.banks.updateBalance(user, id, body.balance);
  }

  @Post('payables')
  @RequirePermissions('finance.write', '*')
  @Audited('AccountPayable')
  createPayable(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.finance.createPayable(user, body as Parameters<FinanceService['createPayable']>[1]);
  }

  @Patch('payables/:id/approval')
  @RequirePermissions('finance.write', '*')
  approve(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { approve: boolean }) {
    return this.finance.approvePayable(user, id, body.approve);
  }

  @Post('payables/:id/pay')
  @RequirePermissions('finance.write', '*')
  pay(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: { amount?: number; settlementDate?: string; notes?: string; chartAccountId?: string },
  ) {
    return this.finance.markPayablePaid(user, id, body);
  }

  @Post('receivables')
  @RequirePermissions('finance.write', '*')
  @Audited('AccountReceivable')
  createReceivable(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.finance.createReceivable(user, body as Parameters<FinanceService['createReceivable']>[1]);
  }

  @Post('receivables/:id/receive')
  @RequirePermissions('finance.write', '*')
  receiveReceivable(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: { amount?: number; settlementDate?: string; notes?: string; chartAccountId?: string },
  ) {
    return this.finance.receiveReceivable(user, id, body);
  }

  @Post('purchase-orders/:orderId/generate-payables')
  @RequirePermissions('finance.write', 'purchasing.write', '*')
  generatePayablesFromOrder(
    @CurrentUser() user: JwtPayload,
    @Param('orderId') orderId: string,
    @Body() body: { partnerId: string; chartAccountId: string },
  ) {
    return this.finance.generatePayablesFromOrder(user, orderId, body);
  }
}
