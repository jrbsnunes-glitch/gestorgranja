import { LicenseStatus, type CommercialPlan, type Tenant } from '../generated/central-client';
import {
  type CommercialPlanCode,
  initialLicenseExpiresAt,
  resolvePlanLimits,
} from './plans';

export type ActivateLicenseInput = {
  slug: string;
  plan: CommercialPlanCode;
  entryPaidAt?: Date;
  contractStartedAt?: Date;
  billingDay?: number;
  status?: LicenseStatus;
  maxBirds?: number;
  maxBarns?: number;
  maxUsers?: number;
};

export function toCommercialPlanEnum(plan: CommercialPlanCode): CommercialPlan {
  return plan as CommercialPlan;
}

export function buildActivateLicenseUpdate(input: ActivateLicenseInput) {
  const limits = resolvePlanLimits(input.plan, {
    maxBirds: input.maxBirds,
    maxBarns: input.maxBarns,
    maxUsers: input.maxUsers,
  });
  const entryAt = input.entryPaidAt ?? input.contractStartedAt ?? new Date();
  const status =
    input.status ??
    (input.plan === 'trial' ? LicenseStatus.trial : LicenseStatus.active);

  const data: Record<string, unknown> = {
    commercialPlan: toCommercialPlanEnum(input.plan),
    maxBirds: limits.maxBirds,
    maxBarns: limits.maxBarns,
    maxUsers: limits.maxUsers,
    licenseStatus: status,
    contractStartedAt: input.contractStartedAt ?? entryAt,
    billingDay: input.billingDay ?? 10,
  };
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
