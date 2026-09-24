import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import * as path from 'path';
import { AlertsModule } from './alerts/alerts.module';
import { AssetsModule } from './assets/assets.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CadastrosModule } from './cadastros/cadastros.module';
import { CashModule } from './cash/cash.module';
import { CommercialModule } from './commercial/commercial.module';
import { ComplianceModule } from './compliance/compliance.module';
import { FinanceModule } from './finance/finance.module';
import { HrModule } from './hr/hr.module';
import { FiscalModule } from './fiscal/fiscal.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { JobsModule } from './jobs/jobs.module';
import { NutritionModule } from './nutrition/nutrition.module';
import { ProductionModule } from './production/production.module';
import { ProvisioningModule } from './provisioning/provisioning.module';
import { PrismaModule } from './prisma/prisma.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { ReportsModule } from './reports/reports.module';
import { SanidadeModule } from './sanidade/sanidade.module';
import { SyncModule } from './sync/sync.module';
import { TenantModule } from './tenant/tenant.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        path.join(process.cwd(), '.env'),
        path.join(process.cwd(), '../../.env'),
      ],
    }),
    PrismaModule,
    TenantModule,
    AuthModule,
    CadastrosModule,
    HrModule,
    CashModule,
    UsersModule,
    ProductionModule,
    NutritionModule,
    SanidadeModule,
    InventoryModule,
    PurchasingModule,
    FinanceModule,
    CommercialModule,
    ReportsModule,
    JobsModule,
    AlertsModule,
    SyncModule,
    AuditModule,
    ProvisioningModule,
    FiscalModule,
    ComplianceModule,
    AssetsModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule {}
