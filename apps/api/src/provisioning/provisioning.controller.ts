import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TenantProvisioningService } from './tenant-provisioning.service';

class ProvisionDto {
  slug!: string;
  cnpj!: string;
  companyName!: string;
  databaseName!: string;
  adminEmail!: string;
  adminPassword!: string;
  adminName?: string;
}

@ApiTags('provisioning')
@Controller('v1/provisioning')
export class ProvisioningController {
  constructor(private readonly provisioning: TenantProvisioningService) {}

  @Post('tenants')
  create(@Body() body: ProvisionDto) {
    return this.provisioning.provisionNewTenant({
      slug: body.slug,
      cnpj: body.cnpj,
      companyName: body.companyName,
      databaseName: body.databaseName,
      seed: {
        adminEmail: body.adminEmail,
        adminPassword: body.adminPassword,
        adminName: body.adminName,
      },
    });
  }
}
