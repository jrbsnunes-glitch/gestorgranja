import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { AlertType } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class ComplianceService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async listLicenses(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.farmLicense.findMany({ orderBy: { validUntil: 'asc' } });
  }

  async createLicense(
    user: JwtPayload,
    data: {
      licenseType: string;
      number: string;
      validFrom: string;
      validUntil: string;
      rtName?: string;
      rtDocument?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.farmLicense.create({
      data: {
        licenseType: data.licenseType,
        number: data.number,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        rtName: data.rtName,
        rtDocument: data.rtDocument,
      },
    });

    const days = (row.validUntil.getTime() - Date.now()) / 86400000;
    if (days <= 60) {
      await prisma.alert.create({
        data: {
          type: AlertType.LICENSE_EXPIRY,
          title: 'Licença próxima do vencimento',
          message: `${row.licenseType} ${row.number} vence em ${row.validUntil.toISOString().slice(0, 10)}`,
          referenceId: row.id,
          dueAt: row.validUntil,
        },
      });
    }
    return row;
  }

  async listContracts(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.contract.findMany({ orderBy: { startsAt: 'desc' } });
  }
}
