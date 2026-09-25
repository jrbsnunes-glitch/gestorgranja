/**
 * Planos comerciais GestorGranja (operados pelo portal de licenças).
 * Valores de entrada e mensalidade ficam no tenant (contractEntryFeeBrl / contractMonthlyFeeBrl).
 */

export type CommercialPlanCode = 'basic' | 'complete';

export const UNLIMITED_TENANT_CAP = 2_147_483_647;

export const PLAN_CATALOG: Record<
  CommercialPlanCode,
  { label: string; includesPayroll: boolean; includesTimeClock: boolean }
> = {
  basic: {
    label: 'Básico',
    includesPayroll: false,
    includesTimeClock: false,
  },
  complete: {
    label: 'Completo',
    includesPayroll: true,
    includesTimeClock: true,
  },
};

export function planDisplayName(plan: CommercialPlanCode | string): string {
  if (plan === 'complete') return PLAN_CATALOG.complete.label;
  if (plan === 'basic') return PLAN_CATALOG.basic.label;
  return String(plan);
}

export function planIncludesPayroll(plan: CommercialPlanCode | string): boolean {
  return plan === 'complete';
}

export function planIncludesTimeClock(plan: CommercialPlanCode | string): boolean {
  return plan === 'complete';
}

export function unlimitedTenantLimits() {
  return {
    maxBirds: UNLIMITED_TENANT_CAP,
    maxBarns: UNLIMITED_TENANT_CAP,
    maxUsers: UNLIMITED_TENANT_CAP,
  };
}

/** Validade inicial após ativação (+1 mês). */
export function initialLicenseExpiresAt(_plan: CommercialPlanCode, from = new Date()): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d;
}
