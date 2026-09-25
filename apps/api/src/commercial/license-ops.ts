import { LicenseStatus, type CommercialPlan, type Tenant } from '../generated/central-client';
import {
  type CommercialPlanCode,
  initialLicenseExpiresAt,
  unlimitedTenantLimits,
} from './plans';

export type ActivateLicenseInput = {
  slug: string;
  plan: CommercialPlanCode;
  entryPaidAt?: Date;
  contractStartedAt?: Date;
  billingDay?: number;
  status?: LicenseStatus;
  contractEntryFeeBrl?: number;
  contractMonthlyFeeBrl?: number;
};

export function toCommercialPlanEnum(plan: CommercialPlanCode): CommercialPlan {
  return plan as CommercialPlan;
}

export function buildActivateLicenseUpdate(input: ActivateLicenseInput) {
  const limits = unlimitedTenantLimits();
  const entryAt = input.entryPaidAt ?? input.contractStartedAt ?? new Date();
  const status = input.status ?? LicenseStatus.active;

  const data: Record<string, unknown> = {
    commercialPlan: toCommercialPlanEnum(input.plan),
    maxBirds: limits.maxBirds,
    maxBarns: limits.maxBarns,
    maxUsers: limits.maxUsers,
    licenseStatus: status,
    contractStartedAt: input.contractStartedAt ?? entryAt,
    billingDay: input.billingDay ?? 10,
  };
  if (input.contractEntryFeeBrl !== undefined) {
    data.contractEntryFeeBrl = input.contractEntryFeeBrl;
  }
  if (input.contractMonthlyFeeBrl !== undefined) {
    data.contractMonthlyFeeBrl = input.contractMonthlyFeeBrl;
  }
  if (status === LicenseStatus.active || status === LicenseStatus.trial) {
    data.licenseExpiresAt = initialLicenseExpiresAt(input.plan, entryAt);
  }
  return data;
}

export function extendLicenseExpiresAt(tenant: Tenant, months: number, from = new Date()): Date {
  const base =
    tenant.licenseExpiresAt && tenant.licenseExpiresAt > from ? tenant.licenseExpiresAt : from;
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}
