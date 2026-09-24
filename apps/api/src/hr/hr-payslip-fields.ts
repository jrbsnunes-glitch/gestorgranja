/** Campos opcionais exibidos no holerite (configurável por tenant). */

export type PayslipFieldsConfig = {
  showCompanyAddressOnSlip: boolean;
  showPis: boolean;
  showInternalId: boolean;
  showAdmissionDate: boolean;
  showIrrfDependents: boolean;
  showBankPayment: boolean;
  showPaymentDate: boolean;
  showWorkDaysReference: boolean;
};

export const DEFAULT_PAYSLIP_FIELDS: PayslipFieldsConfig = {
  showCompanyAddressOnSlip: true,
  showPis: true,
  showInternalId: true,
  showAdmissionDate: false,
  showIrrfDependents: true,
  showBankPayment: false,
  showPaymentDate: false,
  showWorkDaysReference: false,
};

export function mergePayslipFields(raw: unknown): PayslipFieldsConfig {
  const base = { ...DEFAULT_PAYSLIP_FIELDS };
  if (!raw || typeof raw !== 'object') return base;
  const o = raw as Record<string, unknown>;
  for (const key of Object.keys(DEFAULT_PAYSLIP_FIELDS) as (keyof PayslipFieldsConfig)[]) {
    if (typeof o[key] === 'boolean') base[key] = o[key];
  }
  return base;
}

export function calendarDaysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
