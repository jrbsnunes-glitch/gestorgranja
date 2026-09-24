import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { ProductionController } from './production.controller';
import { EggProductionStockService } from './egg-production-stock.service';
import { ProductionService } from './production.service';

@Module({
  imports: [AuthModule, AuditModule],
  controllers: [ProductionController],
  providers: [ProductionService, EggProductionStockService],
  exports: [ProductionService, EggProductionStockService],
})
export class ProductionModule {}
