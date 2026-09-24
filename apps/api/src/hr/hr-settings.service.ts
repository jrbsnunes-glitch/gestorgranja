import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { mergePayslipFields, type PayslipFieldsConfig } from './hr-payslip-fields';

@Injectable()
export class HrSettingsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async get(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    let row = await prisma.hrSettings.findUnique({ where: { id: 'default' } });
    if (!row) {
      row = await prisma.hrSettings.create({ data: { id: 'default' } });
    }
    return {
      ...row,
      payslipFields: mergePayslipFields(row.payslipFields),
    };
  }

  async update(
    user: JwtPayload,
    data: {
      productWithdrawalWarnPct?: number;
      requireWithdrawalPayrollAuth?: boolean;
      detailWithdrawalsOnPayslip?: boolean;
      payslipFields?: Partial<PayslipFieldsConfig>;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const current = await this.get(user);
    const patch: Record<string, unknown> = { ...data };
    if (data.payslipFields) {
      patch.payslipFields = { ...current.payslipFields, ...data.payslipFields };
    }
    const updated = await prisma.hrSettings.update({
      where: { id: 'default' },
      data: patch,
    });
    return {
      ...updated,
      payslipFields: mergePayslipFields(updated.payslipFields),
    };
  }
}
