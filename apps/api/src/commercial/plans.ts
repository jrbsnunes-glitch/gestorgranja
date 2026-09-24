/**
 * Planos comerciais pequeno produtor (até ~5k aves).
 * Fonte operacional: docs/comercial/limites-contratuais.md
 */

export type CommercialPlanCode = 'trial' | 'package_a' | 'package_b' | 'package_c' | 'pilot';

export type PlanLimits = {
  maxBirds: number;
  maxBarns: number;
  maxUsers: number;
  maxTenantsPerCnpj: number;
};

export type PlanPricing = {
  entryFeeBrl: number;
  monthlyFeeBrl: number;
  minContractMonths: number;
  /** Meses de mensalidade cobertos pela entrada (pacote âncora B). */
  entryCoversMonths: number;
};

export const SMALL_PRODUCER_DEFAULT_LIMITS: PlanLimits = {
  maxBirds: 5_000,
  maxBarns: 3,
  maxUsers: 5,
  maxTenantsPerCnpj: 1,
};

export const COMMERCIAL_PLANS: Record<
  Exclude<CommercialPlanCode, 'trial'>,
  { label: string; limits: PlanLimits; pricing: PlanPricing }
> = {
  package_a: {
    label: 'A — Acesso rápido',
    limits: SMALL_PRODUCER_DEFAULT_LIMITS,
    pricing: {
      entryFeeBrl: 490,
      monthlyFeeBrl: 69,
      minContractMonths: 12,
      entryCoversMonths: 0,
    },
  },
  package_b: {
    label: 'B — Profissional (âncora)',
    limits: SMALL_PRODUCER_DEFAULT_LIMITS,
    pricing: {
      entryFeeBrl: 990,
      monthlyFeeBrl: 89,
      minContractMonths: 12,
      entryCoversMonths: 2,
    },
  },
  package_c: {
    label: 'C — Premium onboarding',
    limits: SMALL_PRODUCER_DEFAULT_LIMITS,
    pricing: {
      entryFeeBrl: 1_490,
      monthlyFeeBrl: 109,
      minContractMonths: 12,
      entryCoversMonths: 0,
    },
  },
  pilot: {
    label: 'Piloto pago',
    limits: SMALL_PRODUCER_DEFAULT_LIMITS,
    pricing: {
      entryFeeBrl: 290,
      monthlyFeeBrl: 49,
      minContractMonths: 2,
      entryCoversMonths: 0,
    },
  },
};

/** Política de excesso (contrato + operação manual na Fase 1). */
export const EXCESS_POLICY = {
  birds: {
    measure: 'Soma das aves alojadas nos lotes ativos no tenant.',
    softThresholdRatio: 0.9,
    graceDaysAfterHardLimit: 30,
    resolution: 'Upgrade para add-on de capacidade ou redução de plantel registrada.',
  },
  barns: {
    measure: 'Contagem de galpões cadastrados (Barn).',
    resolution: 'Add-on “galpão extra” na mensalidade ou migração de pacote.',
  },
  users: {
    measure: 'Usuários ativos (contas com login, não desativadas).',
    resolution: 'Add-on “usuário nomeado” ou desativação de conta excedente.',
  },
  cnpj: {
    measure: '1 tenant (slug) por CNPJ no banco central.',
    resolution: 'Novo CNPJ exige novo contrato / tenant.',
  },
} as const;

export function planDisplayPricing(plan: CommercialPlanCode): {
  label: string;
  entryFeeBrl: number;
  monthlyFeeBrl: number;
} {
  if (plan === 'trial') {
    return { label: 'Trial', entryFeeBrl: 0, monthlyFeeBrl: 0 };
  }
  const row = COMMERCIAL_PLANS[plan];
  return {
    label: row.label,
    entryFeeBrl: row.pricing.entryFeeBrl,
    monthlyFeeBrl: row.pricing.monthlyFeeBrl,
  };
}

export function resolvePlanLimits(
  plan: CommercialPlanCode,
  overrides?: Partial<PlanLimits>,
): PlanLimits {
  if (plan === 'trial') {
    return {
      maxBirds: 500,
      maxBarns: 1,
      maxUsers: 2,
      maxTenantsPerCnpj: 1,
      ...overrides,
    };
  }
  return { ...COMMERCIAL_PLANS[plan].limits, ...overrides };
}

/** Data até a qual o acesso permanece ativo após confirmação da entrada. */
export function initialLicenseExpiresAt(plan: CommercialPlanCode, from = new Date()): Date {
  const d = new Date(from);
  if (plan === 'trial') {
    d.setDate(d.getDate() + 15);
    return d;
  }
  if (plan === 'pilot') {
    d.setDate(d.getDate() + 60);
    return d;
  }
  const covers =
    plan === 'package_b'
      ? COMMERCIAL_PLANS.package_b.pricing.entryCoversMonths
      : 0;
  if (covers > 0) {
    d.setMonth(d.getMonth() + covers);
    return d;
  }
  d.setMonth(d.getMonth() + 1);
  return d;
}
