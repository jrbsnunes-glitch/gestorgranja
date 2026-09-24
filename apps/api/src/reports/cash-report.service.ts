import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashMovementType, Prisma } from '../generated/tenant-client';
import { loadCompanyBranding } from '../cadastros/company-branding.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type CashReportVariant = 'controle' | 'periodo' | 'dia';

export type CashReportQuery = {
  variant: CashReportVariant;
  from?: string;
  to?: string;
  date?: string;
  controlMin?: number;
  controlMax?: number;
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

function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

function movementTotals(
  movements: { type: CashMovementType; amount: Prisma.Decimal; isExpense?: boolean }[],
) {
  let inflow = 0;
  let outflow = 0;
  let expenses = 0;
  for (const m of movements) {
    const v = dec(m.amount);
    if (m.type === CashMovementType.IN) inflow += v;
    else {
      outflow += v;
      if (m.isExpense) expenses += v;
    }
  }
  return { inflow, outflow, expenses, net: inflow - outflow };
}

function mapMovement(
  m: {
    id: string;
    type: CashMovementType;
    amount: Prisma.Decimal;
    paymentMethod: string | null;
    reason: string | null;
    isExpense?: boolean;
    createdAt: Date;
    session: { controlNumber: number; user: { name: string; username: string } };
  },
) {
  return {
    id: m.id,
    sessionControlNumber: m.session.controlNumber,
    operatorName: m.session.user.name,
    operatorUsername: m.session.user.username,
    type: m.type,
    isExpense: m.isExpense ?? false,
    amount: dec(m.amount),
    paymentMethod: m.paymentMethod,
    reason: m.reason,
    createdAt: m.createdAt.toISOString(),
  };
}

function mapSessionBlock(
  s: {
    controlNumber: number;
    status: string;
    openedAt: Date;
    closedAt: Date | null;
    openingBalance: Prisma.Decimal;
    closingBalance: Prisma.Decimal | null;
    closingNotes: string | null;
    user: { name: string; username: string };
    movements: {
      id: string;
      type: CashMovementType;
      amount: Prisma.Decimal;
      paymentMethod: string | null;
      reason: string | null;
      isExpense?: boolean;
      createdAt: Date;
    }[];
  },
) {
  const totals = movementTotals(s.movements);
  const opening = dec(s.openingBalance);
  const computedBalance = opening + totals.inflow - totals.outflow;
  return {
    controlNumber: s.controlNumber,
    status: s.status,
    openedAt: s.openedAt.toISOString(),
    closedAt: s.closedAt?.toISOString() ?? null,
    operatorName: s.user.name,
    operatorUsername: s.user.username,
    openingBalance: opening,
    closingBalance: s.closingBalance != null ? dec(s.closingBalance) : null,
    closingNotes: s.closingNotes,
    inflow: totals.inflow,
    outflow: totals.outflow,
    expenses: totals.expenses,
    computedBalance,
    movements: s.movements.map((m) => ({
      id: m.id,
      type: m.type,
      isExpense: m.isExpense ?? false,
      amount: dec(m.amount),
      paymentMethod: m.paymentMethod,
      reason: m.reason,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class CashReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: CashReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const reportCompany = await loadCompanyBranding(prisma, user.tenantSlug);

    if (query.variant === 'controle') {
      const min = query.controlMin;
      const max = query.controlMax ?? query.controlMin;
      if (min == null || !Number.isFinite(min)) {
        throw new BadRequestException('Informe o número de controle (mínimo).');
      }
      const cMax = max ?? min;
      const sessions = await prisma.cashRegisterSession.findMany({
        where: { controlNumber: { gte: min, lte: cMax } },
        orderBy: { controlNumber: 'asc' },
        include: {
          user: { select: { name: true, username: true } },
          movements: { orderBy: { createdAt: 'asc' } },
        },
      });
      return {
        variant: 'controle' as const,
        controlRange: { min, max: cMax },
        sessions: sessions.map(mapSessionBlock),
        company: reportCompany,
      };
    }

    let from: Date;
    let to: Date;
    if (query.variant === 'dia') {
      const day = parseDay(query.date ?? query.from, 'start');
      if (!day) throw new BadRequestException('Informe a data (AAAA-MM-DD).');
      from = day;
      to = parseDay(query.date ?? query.from, 'end')!;
    } else {
      const f = parseDay(query.from, 'start');
      const t = parseDay(query.to, 'end');
      if (!f || !t) throw new BadRequestException('Informe período de e até.');
      if (f > t) throw new BadRequestException('Período inválido.');
      from = f;
      to = t;
    }

    const movements = await prisma.cashMovement.findMany({
      where: { createdAt: { gte: from, lte: to } },
      orderBy: { createdAt: 'asc' },
      include: {
        session: { include: { user: { select: { name: true, username: true } } } },
      },
    });

    const sessionIds = [...new Set(movements.map((m) => m.sessionId))];
    const sessions =
      sessionIds.length > 0
        ? await prisma.cashRegisterSession.findMany({
            where: { id: { in: sessionIds } },
            orderBy: { openedAt: 'asc' },
            include: {
              user: { select: { name: true, username: true } },
              movements: {
                where: { createdAt: { gte: from, lte: to } },
                orderBy: { createdAt: 'asc' },
              },
            },
          })
        : [];

    const totals = movementTotals(movements);

    return {
      variant: query.variant,
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      totals: {
        inflow: totals.inflow,
        outflow: totals.outflow,
        net: totals.net,
        movementCount: movements.length,
        sessionCount: sessions.length,
      },
      sessions: sessions.map(mapSessionBlock),
      movements: movements.map(mapMovement),
      company: reportCompany,
    };
  }
}
