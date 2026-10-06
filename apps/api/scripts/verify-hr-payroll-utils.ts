/**
 * Verificação rápida das utilidades de ponto/folha (sem framework de testes).
 * Executar: pnpm --filter api verify:hr-payroll
 */
import {
  dailyEarningAmount,
  hourlyEarningAmount,
  workedDaysFromPunches,
  workedHoursFromPunches,
  workedMinutesFromPunches,
  type PunchRow,
} from '../src/hr/hr-payroll-punch.util';

function assert(cond: boolean, msg: string) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const d = (iso: string) => new Date(iso);

const pair: PunchRow[] = [
  { type: 'IN', punchedAt: d('2026-03-01T08:00:00') },
  { type: 'OUT', punchedAt: d('2026-03-01T12:00:00') },
];

assert(workedMinutesFromPunches(pair) === 240, '4h pair');
assert(workedHoursFromPunches(pair) === 4, '4h as hours');
assert(workedDaysFromPunches(pair) === 1, 'one day');

const twoDays: PunchRow[] = [
  { type: 'IN', punchedAt: d('2026-03-01T08:00:00') },
  { type: 'OUT', punchedAt: d('2026-03-01T17:00:00') },
  { type: 'IN', punchedAt: d('2026-03-02T08:00:00') },
  { type: 'OUT', punchedAt: d('2026-03-02T12:00:00') },
];
assert(workedDaysFromPunches(twoDays) === 2, 'two distinct days');
assert(workedHoursFromPunches(twoDays) === 13, '9h + 4h');

assert(hourlyEarningAmount(10, 25.5) === 255, 'hourly earning');
assert(dailyEarningAmount(3, 100) === 300, 'daily earning');

console.log('OK: verify-hr-payroll-utils');
