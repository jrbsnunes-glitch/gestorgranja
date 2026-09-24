import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { ProvisioningController } from './provisioning.controller';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Module({
  imports: [TenantModule],
  controllers: [ProvisioningController],
  providers: [TenantProvisioningService],
  exports: [TenantProvisioningService],
})
export class ProvisioningModule {}
