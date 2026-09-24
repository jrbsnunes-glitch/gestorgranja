import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NutritionModule } from '../nutrition/nutrition.module';
import { ProductionModule } from '../production/production.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [AuthModule, ProductionModule, NutritionModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}
