import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BankAccountService } from './bank-account.service';
import { BudgetService } from './budget.service';
import { CashFlowService } from './cash-flow.service';
import { FinanceAlertSettingsService } from './finance-alert-settings.service';
import { FinanceCashImpactService } from './finance-cash-impact.service';
import { FinanceController } from './finance.controller';
import { FinanceDashboardService } from './finance-dashboard.service';
import { FinanceService } from './finance.service';
import { RecurringFinanceService } from './recurring-finance.service';

@Module({
  imports: [AuthModule],
  controllers: [FinanceController],
  providers: [
    RecurringFinanceService,
    FinanceService,
    FinanceDashboardService,
    CashFlowService,
    FinanceAlertSettingsService,
    FinanceCashImpactService,
    BudgetService,
    BankAccountService,
  ],
  exports: [FinanceService, FinanceCashImpactService, CashFlowService, RecurringFinanceService],
})
export class FinanceModule {}
