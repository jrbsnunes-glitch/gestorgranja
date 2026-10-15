import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FinanceModule } from '../finance/finance.module';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';
import { CommercialRequisitionService } from './commercial-requisition.service';

@Module({
  imports: [AuthModule, FinanceModule],
  controllers: [CommercialController],
  providers: [CommercialService, CommercialRequisitionService],
  exports: [CommercialService],
})
export class CommercialModule {}
