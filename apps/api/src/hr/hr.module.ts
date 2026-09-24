import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantModule } from '../tenant/tenant.module';
import { HrController } from './hr.controller';
import { HrTimeKioskPublicController } from './hr-time-kiosk-public.controller';
import { HrReportsService } from './hr-reports.service';
import { HrSettingsService } from './hr-settings.service';
import { HrPayrollRubricsService } from './hr-payroll-rubrics.service';
import { HrService } from './hr.service';

@Module({
  imports: [AuthModule, TenantModule],
  controllers: [HrController, HrTimeKioskPublicController],
  providers: [HrService, HrReportsService, HrSettingsService, HrPayrollRubricsService],
  exports: [HrService, HrReportsService],
})
export class HrModule {}
