import { roundMoney } from './hr-payroll-taxes';

export type PunchRow = { type: string; punchedAt: Date };

/** Soma minutos trabalhados a partir de pares IN → OUT consecutivos. */
export function workedMinutesFromPunches(punches: PunchRow[]): number {
  let workedMin = 0;
  for (let i = 0; i < punches.length - 1; i++) {
    if (punches[i].type === 'IN' && punches[i + 1].type === 'OUT') {
      workedMin += (punches[i + 1].punchedAt.getTime() - punches[i].punchedAt.getTime()) / 60000;
    }
  }
  return Math.max(0, workedMin);
}

export function workedHoursFromPunches(punches: PunchRow[]): number {
  return Math.round((workedMinutesFromPunches(punches) / 60) * 100) / 100;
}

/** Dias com pelo menos um par IN/OUT no mesmo dia civil (local). */
export function workedDaysFromPunches(punches: PunchRow[]): number {
  const dayKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const days = new Set<string>();
  for (let i = 0; i < punches.length - 1; i++) {
    if (punches[i].type === 'IN' && punches[i + 1].type === 'OUT') {
      days.add(dayKey(punches[i].punchedAt));
    }
  }
  return days.size;
}

export function hourlyEarningAmount(hours: number, hourlyRate: number): number {
  return roundMoney(Math.max(0, hours) * hourlyRate);
}

export function dailyEarningAmount(days: number, dailyRate: number): number {
  return roundMoney(Math.max(0, days) * dailyRate);
}
