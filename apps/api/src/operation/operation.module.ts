import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { ProductionModule } from '../production/production.module';
import { ConsumptionStockSyncService } from './consumption-stock-sync.service';
import { DailySummaryService } from './daily-summary.service';
import { OccurrencesService } from './occurrences.service';
import { OperationController } from './operation.controller';
import { OperationAlertsService } from './operation-alerts.service';
import { OperationDashboardService } from './operation-dashboard.service';
import { OperationSettingsService } from './operation-settings.service';
import { OperationalLossService } from './operational-loss.service';
import { PendingService } from './pending.service';
import { ReviewService } from './review.service';
import { SupplyConsumptionService } from './supply-consumption.service';

@Module({
  imports: [AuthModule, AuditModule, ProductionModule],
  controllers: [OperationController],
  providers: [
    OccurrencesService,
    SupplyConsumptionService,
    OperationalLossService,
    DailySummaryService,
    ConsumptionStockSyncService,
    OperationSettingsService,
    ReviewService,
    PendingService,
    OperationDashboardService,
    OperationAlertsService,
  ],
  exports: [
    OccurrencesService,
    SupplyConsumptionService,
    OperationalLossService,
    DailySummaryService,
    ConsumptionStockSyncService,
    OperationSettingsService,
    ReviewService,
    PendingService,
    OperationDashboardService,
    OperationAlertsService,
  ],
})
export class OperationModule {}
