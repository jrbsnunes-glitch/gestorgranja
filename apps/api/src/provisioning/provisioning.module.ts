import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { TenantProvisioningService } from './tenant-provisioning.service';

@Module({
  imports: [TenantModule],
  controllers: [],
  providers: [TenantProvisioningService],
  exports: [TenantProvisioningService],
})
export class ProvisioningModule {}
