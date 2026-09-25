import { apiFetch } from '@/lib/api';

export type TenantSubscription = {
  commercialPlan: 'basic' | 'complete';
  planLabel: string;
  includesPayroll: boolean;
  includesTimeClock: boolean;
};

export function fetchTenantSubscription() {
  return apiFetch<TenantSubscription>('/v1/tenant/subscription');
}

/** Abas RH bloqueadas no plano Básico (sem ponto nem folha). */
export const RH_TABS_PAYROLL_TIME = new Set([
  'retiradas',
  'folha',
  'folha-rubricas',
  'ponto',
  'terminal',
]);

export function isRhTabAllowed(tabId: string, sub: TenantSubscription | null): boolean {
  if (!sub) return true;
  if (sub.includesPayroll && sub.includesTimeClock) return true;
  return !RH_TABS_PAYROLL_TIME.has(tabId);
}
