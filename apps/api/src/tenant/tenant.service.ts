import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LicenseStatus } from '../generated/central-client';
import { CentralPrismaService } from '../prisma/central-prisma.service';

@Injectable()
export class TenantService {
  constructor(private readonly central: CentralPrismaService) {}

  async getBySlug(slug: string) {
    const tenant = await this.central.tenant.findUnique({ where: { slug } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  async getCommercialLimits(slug: string) {
    const tenant = await this.getBySlug(slug);
    return {
      commercialPlan: tenant.commercialPlan,
      maxBirds: tenant.maxBirds,
      maxBarns: tenant.maxBarns,
      maxUsers: tenant.maxUsers,
      billingDay: tenant.billingDay,
      licenseStatus: tenant.licenseStatus,
      licenseExpiresAt: tenant.licenseExpiresAt,
    };
  }

  async assertLicenseActive(slug: string) {
    const tenant = await this.getBySlug(slug);
    const now = new Date();
    if (
      tenant.licenseExpiresAt &&
      tenant.licenseExpiresAt < now &&
      tenant.licenseStatus === LicenseStatus.active
    ) {
      await this.central.tenant.update({
        where: { slug },
        data: { licenseStatus: LicenseStatus.expired },
      });
      throw new ForbiddenException('Licença expirada');
    }
    if (tenant.licenseStatus === LicenseStatus.suspended || tenant.licenseStatus === LicenseStatus.expired) {
      throw new ForbiddenException('Licença inativa ou suspensa');
    }
    if (tenant.licenseExpiresAt && tenant.licenseExpiresAt < now) {
      throw new ForbiddenException('Licença expirada');
    }
  }
}
