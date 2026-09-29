import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CashModule } from '../cash/cash.module';
import { CommercialModule } from '../commercial/commercial.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OperationModule } from '../operation/operation.module';
import { ProductionModule } from '../production/production.module';
import { HomeController } from './home.controller';
import { HomeDashboardService } from './home-dashboard.service';

@Module({
  imports: [
    AuthModule,
    OperationModule,
    FinanceModule,
    CashModule,
    CommercialModule,
    InventoryModule,
    ProductionModule,
  ],
  controllers: [HomeController],
  providers: [HomeDashboardService],
})
export class HomeModule {}
