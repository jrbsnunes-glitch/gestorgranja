import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type HrLeavesReportVariant = 'espelho' | 'listagem';

export type HrLeavesReportQuery = {
  variant: HrLeavesReportVariant;
  from?: string;
  to?: string;
  jobTitle?: string;
  leaveId?: string;
};

function parseDay(raw: string | undefined, mode: 'start' | 'end'): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (mode === 'end') d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function inclusiveDays(start: Date, end: Date): number {
  const s = new Date(start);
  const e = new Date(end);
  s.setHours(0, 0, 0, 0);
  e.setHours(0, 0, 0, 0);
  const diff = e.getTime() - s.getTime();
  if (diff < 0) return 0;
  return Math.floor(diff / 86400000) + 1;
}

function mapLeave(row: {
  id: string;
  controlNumber: number;
  type: string;
  startsAt: Date;
  endsAt: Date;
  cidCode: string | null;
  notes: string | null;
  employee: { name: string; jobTitle: string | null; cpf: string | null };
}) {
  const days = inclusiveDays(row.startsAt, row.endsAt);
  return {
    id: row.id,
    controlNumber: row.controlNumber,
    type: row.type,
    startsAt: row.startsAt.toISOString().slice(0, 10),
    endsAt: row.endsAt.toISOString().slice(0, 10),
    days,
    cidCode: row.cidCode,
    notes: row.notes,
    employeeName: row.employee.name,
    jobTitle: row.employee.jobTitle,
    cpf: row.employee.cpf,
  };
}

@Injectable()
export class HrLeavesReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: HrLeavesReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);

    if (query.variant === 'espelho') {
      if (!query.leaveId?.trim()) {
        throw new BadRequestException('Informe o atestado (seleção na lista).');
      }
      const row = await prisma.leaveAbsence.findUnique({
        where: { id: query.leaveId.trim() },
        include: { employee: { select: { name: true, jobTitle: true, cpf: true } } },
      });
      if (!row) {
        return {
          variant: query.variant,
          period: { from: null, to: null },
          filters: { jobTitle: null, jobTitleLabel: null, leaveId: query.leaveId },
          totals: { count: 0, totalDays: 0 },
          espelho: null,
          rows: null,
        };
      }
      const espelho = mapLeave(row);
      return {
        variant: query.variant,
        period: { from: null, to: null },
        filters: { jobTitle: null, jobTitleLabel: null, leaveId: query.leaveId },
        totals: { count: 1, totalDays: espelho.days },
        espelho,
        rows: null,
      };
    }

    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');

    const where: Prisma.LeaveAbsenceWhereInput = {};
    if (from || to) {
      where.AND = [];
      if (from) where.AND.push({ endsAt: { gte: from } });
      if (to) where.AND.push({ startsAt: { lte: to } });
    }
    if (query.jobTitle === '__sem_cargo__') {
      where.employee = { jobTitle: null };
    } else if (query.jobTitle?.trim()) {
      where.employee = { jobTitle: query.jobTitle.trim() };
    }

    const leaves = await prisma.leaveAbsence.findMany({
      where,
      include: { employee: { select: { name: true, jobTitle: true, cpf: true } } },
      orderBy: [{ controlNumber: 'asc' }],
    });

    const rows = leaves.map(mapLeave);
    const totals = rows.reduce(
      (acc, r) => {
        acc.count += 1;
        acc.totalDays += r.days;
        return acc;
      },
      { count: 0, totalDays: 0 },
    );

    let jobTitleLabel: string | null = null;
    if (query.jobTitle === '__sem_cargo__') jobTitleLabel = 'Sem cargo informado';
    else if (query.jobTitle?.trim()) jobTitleLabel = query.jobTitle.trim();

    return {
      variant: query.variant,
      period: { from: query.from ?? null, to: query.to ?? null },
      filters: {
        jobTitle: query.jobTitle ?? null,
        jobTitleLabel,
        leaveId: null,
      },
      totals,
      espelho: null,
      rows,
    };
  }
}
