import { HazardPayType } from '../generated/tenant-client';
import { roundMoney } from './hr-payroll-taxes';
import { compareYearMonth, monthBounds } from './hr-payroll.util';

export type PayrollEarningDraft = {
  kind: 'EARNING';
  code: string;
  description: string;
  amount: number;
  sourceRef?: string;
};

export function minWageForCompetence(yearMonth: string): number {
  return compareYearMonth(yearMonth, '2026-01') >= 0 ? 1621 : 1518;
}

/** Dias úteis (seg–sáb) e não úteis (dom) — referência DSR estilo contracheque didático. */
export function monthWorkdaySplit(yearMonth: string): { businessDays: number; nonBusinessDays: number } {
  const { start, end } = monthBounds(yearMonth);
  let businessDays = 0;
  let nonBusinessDays = 0;
  for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
    const dow = new Date(t).getUTCDay();
    if (dow === 0) nonBusinessDays += 1;
    else businessDays += 1;
  }
  return { businessDays: Math.max(businessDays, 1), nonBusinessDays };
}

export function calcDsr(refAmount: number, yearMonth: string): number {
  if (refAmount <= 0) return 0;
  const { businessDays, nonBusinessDays } = monthWorkdaySplit(yearMonth);
  return roundMoney((refAmount / businessDays) * nonBusinessDays);
}

export function hazardEarningAmount(
  contractualSalary: number,
  hazardPayType: HazardPayType,
  insalubrityPct: number,
  yearMonth: string,
): { code: string; description: string; amount: number } | null {
  if (hazardPayType === 'PERICULOSIDADE') {
    return {
      code: 'PERIC',
      description: 'Adicional de periculosidade — 30%',
      amount: roundMoney(contractualSalary * 0.3),
    };
  }
  if (hazardPayType === 'INSALUBRIO') {
    const pct = [10, 20, 40].includes(insalubrityPct) ? insalubrityPct : 20;
    const sm = minWageForCompetence(yearMonth);
    return {
      code: 'INSALUB',
      description: `Adicional de insalubridade — ${pct}% s/ salário mínimo`,
      amount: roundMoney(sm * (pct / 100)),
    };
  }
  return null;
}

export function hourlyRate(payrollBaseForHour: number, monthlyWorkHours: number): number {
  const hours = monthlyWorkHours > 0 ? monthlyWorkHours : 220;
  return roundMoney(payrollBaseForHour / hours);
}

export function buildVariableEarnings(input: {
  payrollBaseForHour: number;
  monthlyWorkHours: number;
  yearMonth: string;
  otHours50: number;
  otHours100: number;
  commissionAmount: number;
  ajudaCustoAmount: number;
}): PayrollEarningDraft[] {
  const items: PayrollEarningDraft[] = [];
  const h = hourlyRate(input.payrollBaseForHour, input.monthlyWorkHours);
  const he50Rate = roundMoney(h * 1.5);
  const he100Rate = roundMoney(h * 2);

  if (input.otHours50 > 0) {
    const amount = roundMoney(he50Rate * input.otHours50);
    items.push({
      kind: 'EARNING',
      code: 'HE_50',
      description: `Hora extra (50%) — ${input.otHours50} h`,
      amount,
    });
  }
  if (input.otHours100 > 0) {
    const amount = roundMoney(he100Rate * input.otHours100);
    items.push({
      kind: 'EARNING',
      code: 'HE_100',
      description: `Hora extra (100%) — ${input.otHours100} h`,
      amount,
    });
  }

  const heTotal = items.filter((i) => i.code.startsWith('HE_')).reduce((s, i) => s + i.amount, 0);
  const dsrHe = calcDsr(heTotal, input.yearMonth);
  if (dsrHe > 0) {
    items.push({
      kind: 'EARNING',
      code: 'DSR_HE',
      description: 'DSR (horas extras)',
      amount: dsrHe,
    });
  }

  if (input.commissionAmount > 0) {
    items.push({
      kind: 'EARNING',
      code: 'COMISS',
      description: 'Comissão',
      amount: roundMoney(input.commissionAmount),
    });
    const dsrCom = calcDsr(input.commissionAmount, input.yearMonth);
    if (dsrCom > 0) {
      items.push({
        kind: 'EARNING',
        code: 'DSR_COM',
        description: 'DSR (comissões)',
        amount: dsrCom,
      });
    }
  }

  if (input.ajudaCustoAmount > 0) {
    items.push({
      kind: 'EARNING',
      code: 'AJUDA_CUSTO',
      description: 'Ajuda de custo',
      amount: roundMoney(input.ajudaCustoAmount),
    });
  }

  return items;
}
