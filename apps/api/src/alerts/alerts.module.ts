import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { OperationModule } from '../operation/operation.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertSchedulerService } from './alert-scheduler.service';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

@Module({
  imports: [AuthModule, PrismaModule, FinanceModule, OperationModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertSchedulerService],
})
export class AlertsModule {}
