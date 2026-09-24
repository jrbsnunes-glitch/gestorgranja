import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { HrModule } from '../hr/hr.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { ProductionModule } from '../production/production.module';
import { ReportsController } from './reports.controller';
import { ReportsStubService } from './reports-stub.service';
import { ProductionCostReportService } from './production-cost-report.service';
import { FinanceTitlesReportService } from './finance-titles-report.service';
import { ReceivableAgingReportService } from './receivable-aging-report.service';
import { CashReportService } from './cash-report.service';
import { ProductionDailyReportService } from './production-daily-report.service';
import { ProductsReportService } from './products-report.service';
import { StockMovementsReportService } from './stock-movements-report.service';
import { StockReceiptsReportService } from './stock-receipts-report.service';
import { PurchaseOrdersReportService } from './purchase-orders-report.service';
import { SalesOrdersReportService } from './sales-orders-report.service';
import { HrEmployeesReportService } from './hr-employees-report.service';
import { HrLeavesReportService } from './hr-leaves-report.service';
import { HrVacationsReportService } from './hr-vacations-report.service';
import { ZootechnicalMetricsService } from './zootechnical-metrics.service';

@Module({
  imports: [AuthModule, ProductionModule, NutritionModule, AuditModule, HrModule],
  controllers: [ReportsController],
  providers: [
    ZootechnicalMetricsService,
    ReportsStubService,
    ProductionCostReportService,
    FinanceTitlesReportService,
    ReceivableAgingReportService,
    CashReportService,
    ProductionDailyReportService,
    ProductsReportService,
    StockMovementsReportService,
    StockReceiptsReportService,
    PurchaseOrdersReportService,
    SalesOrdersReportService,
    HrEmployeesReportService,
    HrLeavesReportService,
    HrVacationsReportService,
  ],
  exports: [ZootechnicalMetricsService, ProductionCostReportService, FinanceTitlesReportService],
})
export class ReportsModule {}
