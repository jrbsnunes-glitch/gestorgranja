import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { BankAccountService } from './bank-account.service';
import { BudgetService } from './budget.service';
import { CashFlowService } from './cash-flow.service';
import { FinanceAlertSettingsService } from './finance-alert-settings.service';
import { FinanceCashImpactService } from './finance-cash-impact.service';
import { FinanceController } from './finance.controller';
import { FinanceDashboardService } from './finance-dashboard.service';
import { FinanceService } from './finance.service';
import { RecurringFinanceService } from './recurring-finance.service';
import { SicoobClientService } from './sicoob-client.service';
import { SicoobCobrancaController } from './sicoob-cobranca.controller';
import { SicoobCobrancaService } from './sicoob-cobranca.service';
import { SicoobConciliationScheduler } from './sicoob-conciliation.scheduler';

@Module({
  imports: [AuthModule, FiscalModule],
  controllers: [FinanceController, SicoobCobrancaController],
  providers: [
    RecurringFinanceService,
    FinanceService,
    FinanceDashboardService,
    CashFlowService,
    FinanceAlertSettingsService,
    FinanceCashImpactService,
    BudgetService,
    BankAccountService,
    SicoobClientService,
    SicoobCobrancaService,
    SicoobConciliationScheduler,
  ],
  exports: [
    FinanceService,
    FinanceCashImpactService,
    CashFlowService,
    RecurringFinanceService,
    FinanceDashboardService,
    SicoobCobrancaService,
  ],
})
export class FinanceModule {}
