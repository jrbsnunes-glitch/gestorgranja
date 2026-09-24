/** Agrupa batidas em pares entrada/saída por dia (fuso America/Sao_Paulo). */

export type PunchRow = {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  punchedAt: Date;
  type: 'IN' | 'OUT';
  source: string;
};

export type PunchDayPair = {
  inAt: string | null;
  outAt: string | null;
  minutes: number | null;
  note: string | null;
};

export type PunchDayMirror = {
  date: string;
  pairs: PunchDayPair[];
  totalMinutes: number;
  hasIncomplete: boolean;
};

export type EmployeePunchMirror = {
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  days: PunchDayMirror[];
  totalMinutes: number;
};

const TZ = 'America/Sao_Paulo';

export function punchDateKey(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: TZ });
}

export function formatPunchTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPunchTimeOnly(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
}

function minutesBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 60000));
}

export function buildEmployeePunchMirrors(punches: PunchRow[]): EmployeePunchMirror[] {
  const byEmployee = new Map<string, PunchRow[]>();
  for (const p of punches) {
    const list = byEmployee.get(p.employeeId) ?? [];
    list.push(p);
    byEmployee.set(p.employeeId, list);
  }

  const result: EmployeePunchMirror[] = [];

  for (const [employeeId, rows] of byEmployee) {
    rows.sort((a, b) => a.punchedAt.getTime() - b.punchedAt.getTime());
    const byDay = new Map<string, PunchRow[]>();
    for (const r of rows) {
      const dk = punchDateKey(r.punchedAt);
      const dayRows = byDay.get(dk) ?? [];
      dayRows.push(r);
      byDay.set(dk, dayRows);
    }

    const days: PunchDayMirror[] = [];
    let employeeTotal = 0;

    for (const date of [...byDay.keys()].sort()) {
      const dayPunches = byDay.get(date) ?? [];
      const pairs: PunchDayPair[] = [];
      let openIn: Date | null = null;
      let dayMinutes = 0;
      let hasIncomplete = false;

      for (const p of dayPunches) {
        if (p.type === 'IN') {
          if (openIn) {
            pairs.push({
              inAt: formatPunchTimeOnly(openIn),
              outAt: null,
              minutes: null,
              note: 'Saída não registrada',
            });
            hasIncomplete = true;
          }
          openIn = p.punchedAt;
        } else {
          if (openIn) {
            const mins = minutesBetween(openIn, p.punchedAt);
            pairs.push({
              inAt: formatPunchTimeOnly(openIn),
              outAt: formatPunchTimeOnly(p.punchedAt),
              minutes: mins,
              note: null,
            });
            dayMinutes += mins;
            openIn = null;
          } else {
            pairs.push({
              inAt: null,
              outAt: formatPunchTimeOnly(p.punchedAt),
              minutes: null,
              note: 'Entrada não registrada',
            });
            hasIncomplete = true;
          }
        }
      }
      if (openIn) {
        pairs.push({
          inAt: formatPunchTimeOnly(openIn),
          outAt: null,
          minutes: null,
          note: 'Saída não registrada',
        });
        hasIncomplete = true;
      }

      employeeTotal += dayMinutes;
      days.push({ date, pairs, totalMinutes: dayMinutes, hasIncomplete });
    }

    result.push({
      employeeId,
      employeeName: rows[0]?.employeeName ?? '',
      jobTitle: rows[0]?.jobTitle ?? null,
      days,
      totalMinutes: employeeTotal,
    });
  }

  result.sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'pt-BR'));
  return result;
}

export function formatMinutesAsHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${String(m).padStart(2, '0')}`;
}
