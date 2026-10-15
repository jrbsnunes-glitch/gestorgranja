import { BadRequestException } from '@nestjs/common';
import { prismaDateOnly } from '../common/calendar-date.util';

export const REQUISICAO_KIND = 'REQUISICAO';

export function isRequisicaoKind(kind?: string | null) {
  return (kind ?? '').toUpperCase() === REQUISICAO_KIND;
}

export type RequisitionTermsInput = {
  installmentCount: number;
  firstDueDate: string;
  /** Dias entre parcelas consecutivas (tamanho = installmentCount - 1). Ex.: 5, 15, 30 */
  intervalDays: number[];
  notes?: string;
};

export type RequisitionTerms = RequisitionTermsInput;

export function parseRequisitionTerms(raw: unknown): RequisitionTerms {
  if (!raw || typeof raw !== 'object') {
    throw new BadRequestException('Informe as parcelas da requisição.');
  }
  const o = raw as Record<string, unknown>;
  const installmentCount = Math.floor(Number(o.installmentCount));
  if (!Number.isFinite(installmentCount) || installmentCount < 1 || installmentCount > 120) {
    throw new BadRequestException('Número de parcelas inválido (1 a 120).');
  }
  const firstDueDate = typeof o.firstDueDate === 'string' ? o.firstDueDate.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) {
    throw new BadRequestException('Informe a data da 1ª parcela (AAAA-MM-DD).');
  }
  let intervalDays: number[] = [];
  if (Array.isArray(o.intervalDays)) {
    intervalDays = o.intervalDays.map((x) => Number(x));
  } else if (typeof o.intervalDaysCsv === 'string') {
    intervalDays = o.intervalDaysCsv
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number(s));
  }
  const expectedGaps = Math.max(0, installmentCount - 1);
  if (intervalDays.length !== expectedGaps) {
    throw new BadRequestException(
      expectedGaps === 0
        ? 'Com uma parcela, não informe prazos entre parcelas.'
        : `Informe ${expectedGaps} prazo(s) entre parcelas (ex.: 5, 15, 30).`,
    );
  }
  for (const d of intervalDays) {
    if (!Number.isFinite(d) || d < 0 || d > 3650) {
      throw new BadRequestException('Prazo entre parcelas inválido.');
    }
  }
  const notes = typeof o.notes === 'string' ? o.notes.trim().slice(0, 160) : '';
  return { installmentCount, firstDueDate, intervalDays, ...(notes ? { notes } : {}) };
}

export function requisitionDueDates(terms: RequisitionTerms): Date[] {
  const dates: Date[] = [prismaDateOnly(terms.firstDueDate)];
  for (const gap of terms.intervalDays) {
    const prev = dates[dates.length - 1]!;
    const next = new Date(prev);
    next.setUTCDate(next.getUTCDate() + Math.floor(gap));
    dates.push(next);
  }
  return dates;
}

export function splitRequisitionAmounts(total: number, count: number): number[] {
  const part = Math.round((total / count) * 100) / 100;
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? Math.round((total - part * (count - 1)) * 100) / 100 : part,
  );
}
