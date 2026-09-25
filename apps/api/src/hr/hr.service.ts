import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  EmployeeWithdrawalStatus,
  PayrollLineItemKind,
  PayrollRunStatus,
  VacationStatus,
} from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { createHash, randomBytes } from 'crypto';
import {
  buildStatutoryDeductionLinesFromEarnings,
  roundMoney,
  type RubricIncidence,
} from './hr-payroll-taxes';
import { HrPayrollRubricsService } from './hr-payroll-rubrics.service';
import {
  buildVariableEarnings,
  hazardEarningAmount,
} from './hr-payroll-variable';
import { monthBounds, overlapDays, shiftExpectedMinutes, yearMonthKey } from './hr-payroll.util';

const PAYROLL_LINE_VAR_DEFAULTS = {
  otHours50: 0,
  otHours100: 0,
  commissionAmount: 0,
  ajudaCustoAmount: 0,
};

function parseOptionalString(data: Record<string, unknown>, key: string): string | null | undefined {
  if (data[key] === undefined) return undefined;
  const v = data[key];
  if (v === null || v === '') return null;
  return String(v).trim() || null;
}

function parsePayrollWithdrawalAuthFields(data: Record<string, unknown>) {
  if (data.payrollWithdrawalAuthorizedAt === null || data.payrollWithdrawalAuthorizedAt === '') {
    return {
      payrollWithdrawalAuthorizedAt: null as Date | null,
      payrollWithdrawalAuthReference: null as string | null,
    };
  }
  if (data.payrollWithdrawalAuthorizedAt !== undefined) {
    const raw = String(data.payrollWithdrawalAuthorizedAt).trim();
    return {
      payrollWithdrawalAuthorizedAt: raw ? new Date(`${raw}T12:00:00`) : null,
      payrollWithdrawalAuthReference: data.payrollWithdrawalAuthReference
        ? String(data.payrollWithdrawalAuthReference).trim()
        : null,
    };
  }
  return null;
}

@Injectable()
export class HrService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly payrollRubrics: HrPayrollRubricsService,
    private readonly tenantService: TenantService,
  ) {}

  private db(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  listEmployees(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.employee.findMany({
        orderBy: { name: 'asc' },
        include: {
          user: { select: { id: true, username: true, name: true } },
          workShift: { select: { id: true, code: true, name: true, startTime: true, endTime: true } },
        },
      }),
    );
  }

  private parseWorkShiftId(data: Record<string, unknown>): string | null | undefined {
    if (data.workShiftId === undefined) return undefined;
    if (data.workShiftId === null || data.workShiftId === '') return null;
    return String(data.workShiftId);
  }

  listUsersForLink(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          username: true,
          name: true,
          employees: { select: { id: true, name: true }, take: 1 },
        },
        orderBy: { username: 'asc' },
      }),
    );
  }

  async createEmployee(user: JwtPayload, data: Record<string, unknown>) {
    const prisma = await this.db(user);
    if (data.userId) {
      const taken = await prisma.employee.findUnique({ where: { userId: String(data.userId) } });
      if (taken) throw new BadRequestException('Usuário já vinculado a outro funcionário');
    }
    const workShiftId = this.parseWorkShiftId(data);
    if (workShiftId) {
      const shift = await prisma.workShift.findUnique({ where: { id: workShiftId } });
      if (!shift?.isActive) throw new BadRequestException('Turno inválido ou inativo');
    }
    return prisma.employee.create({
      data: {
        name: String(data.name),
        cpf: data.cpf ? String(data.cpf) : undefined,
        jobTitle: data.jobTitle ? String(data.jobTitle) : undefined,
        userId: data.userId ? String(data.userId) : undefined,
        ...(workShiftId !== undefined ? { workShiftId } : {}),
        hiredAt: data.hiredAt ? new Date(String(data.hiredAt)) : undefined,
        baseSalary: Number(data.baseSalary ?? 0),
        irrfDependents: Math.max(0, Math.floor(Number(data.irrfDependents ?? 0))),
        pisPasep: parseOptionalString(data, 'pisPasep') ?? undefined,
        bankCode: parseOptionalString(data, 'bankCode') ?? undefined,
        bankAgency: parseOptionalString(data, 'bankAgency') ?? undefined,
        bankAccount: parseOptionalString(data, 'bankAccount') ?? undefined,
        bankAccountDigit: parseOptionalString(data, 'bankAccountDigit') ?? undefined,
        hazardPayType:
          data.hazardPayType !== undefined && data.hazardPayType !== null
            ? (String(data.hazardPayType) as 'NONE' | 'INSALUBRIO' | 'PERICULOSIDADE')
            : undefined,
        insalubrityPct:
          data.insalubrityPct !== undefined ? Math.max(0, Math.floor(Number(data.insalubrityPct))) : undefined,
        monthlyWorkHours:
          data.monthlyWorkHours !== undefined ? Math.max(1, Math.floor(Number(data.monthlyWorkHours))) : undefined,
        vtOptIn: data.vtOptIn !== undefined ? Boolean(data.vtOptIn) : undefined,
        ...(() => {
          const auth = parsePayrollWithdrawalAuthFields(data);
          return auth ?? {};
        })(),
      },
    });
  }

  async updateEmployee(user: JwtPayload, id: string, data: Record<string, unknown>) {
    const prisma = await this.db(user);
    const row = await prisma.employee.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Funcionário não encontrado');
    if (data.userId && String(data.userId) !== row.userId) {
      const taken = await prisma.employee.findUnique({ where: { userId: String(data.userId) } });
      if (taken) throw new BadRequestException('Usuário já vinculado a outro funcionário');
    }
    const workShiftId = this.parseWorkShiftId(data);
    if (workShiftId) {
      const shift = await prisma.workShift.findUnique({ where: { id: workShiftId } });
      if (!shift?.isActive) throw new BadRequestException('Turno inválido ou inativo');
    }
    return prisma.employee.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: String(data.name) } : {}),
        ...(data.cpf !== undefined ? { cpf: data.cpf ? String(data.cpf) : null } : {}),
        ...(data.jobTitle !== undefined ? { jobTitle: data.jobTitle ? String(data.jobTitle) : null } : {}),
        ...(data.userId !== undefined ? { userId: data.userId ? String(data.userId) : null } : {}),
        ...(data.hiredAt !== undefined
          ? { hiredAt: data.hiredAt ? new Date(String(data.hiredAt)) : null }
          : {}),
        ...(data.baseSalary !== undefined ? { baseSalary: Number(data.baseSalary) } : {}),
        ...(data.irrfDependents !== undefined
          ? { irrfDependents: Math.max(0, Math.floor(Number(data.irrfDependents))) }
          : {}),
        ...(data.isActive !== undefined ? { isActive: Boolean(data.isActive) } : {}),
        ...(parseOptionalString(data, 'pisPasep') !== undefined
          ? { pisPasep: parseOptionalString(data, 'pisPasep') }
          : {}),
        ...(parseOptionalString(data, 'bankCode') !== undefined
          ? { bankCode: parseOptionalString(data, 'bankCode') }
          : {}),
        ...(parseOptionalString(data, 'bankAgency') !== undefined
          ? { bankAgency: parseOptionalString(data, 'bankAgency') }
          : {}),
        ...(parseOptionalString(data, 'bankAccount') !== undefined
          ? { bankAccount: parseOptionalString(data, 'bankAccount') }
          : {}),
        ...(parseOptionalString(data, 'bankAccountDigit') !== undefined
          ? { bankAccountDigit: parseOptionalString(data, 'bankAccountDigit') }
          : {}),
        ...(data.hazardPayType !== undefined
          ? { hazardPayType: String(data.hazardPayType) as 'NONE' | 'INSALUBRIO' | 'PERICULOSIDADE' }
          : {}),
        ...(data.insalubrityPct !== undefined
          ? { insalubrityPct: Math.max(0, Math.floor(Number(data.insalubrityPct))) }
          : {}),
        ...(data.monthlyWorkHours !== undefined
          ? { monthlyWorkHours: Math.max(1, Math.floor(Number(data.monthlyWorkHours))) }
          : {}),
        ...(data.vtOptIn !== undefined ? { vtOptIn: Boolean(data.vtOptIn) } : {}),
        ...(() => {
          const workShiftId = this.parseWorkShiftId(data);
          if (workShiftId === undefined) return {};
          return { workShiftId };
        })(),
        ...(() => {
          const auth = parsePayrollWithdrawalAuthFields(data);
          return auth ?? {};
        })(),
      },
    });
  }

  async deleteEmployee(user: JwtPayload, id: string) {
    const prisma = await this.db(user);
    const row = await prisma.employee.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Funcionário não encontrado');
    const lines = await prisma.payrollLine.count({ where: { employeeId: id } });
    if (lines > 0) throw new BadRequestException('Funcionário com histórico de folha — inative em vez de excluir');
    await prisma.employee.delete({ where: { id } });
    return { ok: true };
  }

  listLeaves(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.leaveAbsence.findMany({ include: { employee: true }, orderBy: { startsAt: 'desc' } }),
    );
  }

  createLeave(user: JwtPayload, data: Record<string, unknown>) {
    return this.db(user).then((p) =>
      p.leaveAbsence.create({
        data: {
          employeeId: String(data.employeeId),
          type: (data.type as 'MEDICAL' | 'OTHER') ?? 'MEDICAL',
          startsAt: new Date(String(data.startsAt)),
          endsAt: new Date(String(data.endsAt)),
          cidCode: data.cidCode ? String(data.cidCode) : undefined,
          notes: data.notes ? String(data.notes) : undefined,
        },
      }),
    );
  }

  updateLeave(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return this.db(user).then((p) =>
      p.leaveAbsence.update({
        where: { id },
        data: {
          ...(data.employeeId !== undefined ? { employeeId: String(data.employeeId) } : {}),
          ...(data.type !== undefined ? { type: data.type as 'MEDICAL' | 'OTHER' } : {}),
          ...(data.startsAt !== undefined ? { startsAt: new Date(String(data.startsAt)) } : {}),
          ...(data.endsAt !== undefined ? { endsAt: new Date(String(data.endsAt)) } : {}),
          ...(data.cidCode !== undefined ? { cidCode: data.cidCode ? String(data.cidCode) : null } : {}),
          ...(data.notes !== undefined ? { notes: data.notes ? String(data.notes) : null } : {}),
        },
      }),
    );
  }

  deleteLeave(user: JwtPayload, id: string) {
    return this.db(user).then((p) => p.leaveAbsence.delete({ where: { id } }));
  }

  listVacations(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.vacationPlan.findMany({ include: { employee: true }, orderBy: { startsAt: 'desc' } }),
    );
  }

  createVacation(user: JwtPayload, data: Record<string, unknown>) {
    return this.db(user).then((p) =>
      p.vacationPlan.create({
        data: {
          employeeId: String(data.employeeId),
          acquisitionYear: Number(data.acquisitionYear),
          startsAt: new Date(String(data.startsAt)),
          endsAt: new Date(String(data.endsAt)),
          status: VacationStatus.PLANNED,
        },
      }),
    );
  }

  updateVacation(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return this.db(user).then((p) =>
      p.vacationPlan.update({
        where: { id },
        data: {
          ...(data.employeeId !== undefined ? { employeeId: String(data.employeeId) } : {}),
          ...(data.acquisitionYear !== undefined ? { acquisitionYear: Number(data.acquisitionYear) } : {}),
          ...(data.startsAt !== undefined ? { startsAt: new Date(String(data.startsAt)) } : {}),
          ...(data.endsAt !== undefined ? { endsAt: new Date(String(data.endsAt)) } : {}),
          ...(data.status !== undefined ? { status: data.status as VacationStatus } : {}),
        },
      }),
    );
  }

  deleteVacation(user: JwtPayload, id: string) {
    return this.db(user).then((p) => p.vacationPlan.delete({ where: { id } }));
  }

  listWithdrawals(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.employeeProductWithdrawal.findMany({
        orderBy: { withdrawnAt: 'desc' },
        include: {
          employee: {
            select: {
              id: true,
              name: true,
              baseSalary: true,
              payrollWithdrawalAuthorizedAt: true,
              payrollWithdrawalAuthReference: true,
            },
          },
          product: true,
        },
      }),
    );
  }

  async getWithdrawalWarnings(user: JwtPayload) {
    const prisma = await this.db(user);
    let settings = await prisma.hrSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.hrSettings.create({ data: { id: 'default' } });
    }
    const warnPct = Number(settings.productWithdrawalWarnPct);
    const pending = await prisma.employeeProductWithdrawal.findMany({
      where: { status: EmployeeWithdrawalStatus.PENDING },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            baseSalary: true,
            payrollWithdrawalAuthorizedAt: true,
          },
        },
      },
    });

    type Key = string;
    const groups = new Map<
      Key,
      {
        employeeId: string;
        employeeName: string;
        yearMonth: string;
        pendingTotal: number;
        baseSalary: number;
        authorized: boolean;
      }
    >();

    for (const w of pending) {
      const ym = yearMonthKey(w.withdrawnAt);
      const key = `${w.employeeId}:${ym}`;
      const prev = groups.get(key);
      const add = Number(w.totalAmount);
      if (prev) {
        prev.pendingTotal = Math.round((prev.pendingTotal + add) * 100) / 100;
      } else {
        groups.set(key, {
          employeeId: w.employeeId,
          employeeName: w.employee.name,
          yearMonth: ym,
          pendingTotal: add,
          baseSalary: Number(w.employee.baseSalary),
          authorized: w.employee.payrollWithdrawalAuthorizedAt != null,
        });
      }
    }

    const alerts = [...groups.values()]
      .map((g) => {
        const usedPct = g.baseSalary > 0 ? Math.round((g.pendingTotal / g.baseSalary) * 1000) / 10 : null;
        const overThreshold = usedPct != null && usedPct >= warnPct;
        const missingAuth = !g.authorized && g.pendingTotal > 0;
        return { ...g, usedPct, overThreshold, missingAuth };
      })
      .filter((a) => a.overThreshold || a.missingAuth)
      .sort((a, b) => b.pendingTotal - a.pendingTotal);

    return {
      productWithdrawalWarnPct: warnPct,
      requireWithdrawalPayrollAuth: settings.requireWithdrawalPayrollAuth,
      alerts,
    };
  }

  async createWithdrawal(user: JwtPayload, data: Record<string, unknown>) {
    const prisma = await this.db(user);
    const employeeId = String(data.employeeId);
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundException('Funcionário não encontrado');

    let settings = await prisma.hrSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await prisma.hrSettings.create({ data: { id: 'default' } });
    }
    if (settings.requireWithdrawalPayrollAuth && !employee.payrollWithdrawalAuthorizedAt) {
      throw new BadRequestException(
        'Funcionário sem autorização escrita para desconto em folha. Registre a autorização no cadastro do funcionário.',
      );
    }

    const quantity = Number(data.quantity);
    const unitPrice = Number(data.unitPrice);
    const totalAmount = quantity * unitPrice;
    const withdrawnAt = data.withdrawnAt ? new Date(String(data.withdrawnAt)) : new Date();

    const row = await prisma.employeeProductWithdrawal.create({
      data: {
        employeeId,
        productId: String(data.productId),
        quantity,
        unitPrice,
        totalAmount,
        withdrawnAt,
        notes: data.notes ? String(data.notes) : undefined,
        status: EmployeeWithdrawalStatus.PENDING,
      },
      include: { employee: true, product: true },
    });

    const ym = yearMonthKey(withdrawnAt);
    const { start: monthStart, end: monthEnd } = monthBounds(ym);
    const monthPending = await prisma.employeeProductWithdrawal.aggregate({
      where: {
        employeeId,
        status: EmployeeWithdrawalStatus.PENDING,
        withdrawnAt: { gte: monthStart, lte: new Date(monthEnd.getTime() + 86400000 - 1) },
      },
      _sum: { totalAmount: true },
    });
    const pendingTotal = Number(monthPending._sum.totalAmount ?? 0);
    const baseSalary = Number(employee.baseSalary);
    const warnPct = Number(settings.productWithdrawalWarnPct);
    const usedPct = baseSalary > 0 ? Math.round((pendingTotal / baseSalary) * 1000) / 10 : null;
    const warnings: string[] = [];
    if (usedPct != null && usedPct >= warnPct) {
      warnings.push(
        `Retiradas pendentes em ${ym} somam ${usedPct}% do salário base (limite de aviso: ${warnPct}%).`,
      );
    }

    return { withdrawal: row, warnings };
  }

  updateWithdrawal(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return this.db(user).then(async (p) => {
      const row = await p.employeeProductWithdrawal.findUnique({ where: { id } });
      if (!row) throw new NotFoundException();
      if (row.status === EmployeeWithdrawalStatus.APPLIED) {
        throw new BadRequestException('Retirada já aplicada na folha');
      }
      const quantity = data.quantity !== undefined ? Number(data.quantity) : Number(row.quantity);
      const unitPrice = data.unitPrice !== undefined ? Number(data.unitPrice) : Number(row.unitPrice);
      return p.employeeProductWithdrawal.update({
        where: { id },
        data: {
          ...(data.employeeId !== undefined ? { employeeId: String(data.employeeId) } : {}),
          ...(data.productId !== undefined ? { productId: String(data.productId) } : {}),
          ...(data.quantity !== undefined || data.unitPrice !== undefined
            ? { quantity, unitPrice, totalAmount: quantity * unitPrice }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes ? String(data.notes) : null } : {}),
          ...(data.status !== undefined ? { status: data.status as EmployeeWithdrawalStatus } : {}),
        },
      });
    });
  }

  deleteWithdrawal(user: JwtPayload, id: string) {
    return this.db(user).then(async (p) => {
      const row = await p.employeeProductWithdrawal.findUnique({ where: { id } });
      if (!row) throw new NotFoundException();
      if (row.status === EmployeeWithdrawalStatus.APPLIED) {
        throw new BadRequestException('Retirada já aplicada na folha');
      }
      await p.employeeProductWithdrawal.delete({ where: { id } });
      return { ok: true };
    });
  }

  listPayrollRuns(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.payrollRun.findMany({
        include: {
          lines: { include: { employee: true, items: true } },
        },
        orderBy: { yearMonth: 'desc' },
      }),
    );
  }

  private async rubricIncidenceMap(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    codes: string[],
  ): Promise<Map<string, RubricIncidence>> {
    const unique = [...new Set(codes)];
    if (!unique.length) return new Map();
    const rows = await prisma.payrollRubric.findMany({
      where: { code: { in: unique } },
      select: {
        code: true,
        integratesInss: true,
        integratesFgts: true,
        integratesIrrf: true,
      },
    });
    return new Map(
      rows.map((r) => [
        r.code,
        {
          integratesInss: r.integratesInss,
          integratesFgts: r.integratesFgts,
          integratesIrrf: r.integratesIrrf,
        },
      ]),
    );
  }

  private async buildPayrollItemsForEmployee(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    employeeId: string,
    baseSalary: number,
    yearMonth: string,
    monthStart: Date,
    monthEnd: Date,
    lineVars: {
      otHours50: number;
      otHours100: number;
      commissionAmount: number;
      ajudaCustoAmount: number;
    } = PAYROLL_LINE_VAR_DEFAULTS,
  ): Promise<{
    items: {
      kind: PayrollLineItemKind;
      code: string;
      description: string;
      amount: number;
      sourceRef?: string;
    }[];
    payrollBaseDisplay: number | null;
  }> {
    const items: {
      kind: PayrollLineItemKind;
      code: string;
      description: string;
      amount: number;
      sourceRef?: string;
    }[] = [];
    const dailyRate = baseSalary / 30;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { workShift: true },
    });

    let payrollBaseDisplay: number | null = null;
    const hazard = employee
      ? hazardEarningAmount(
          baseSalary,
          employee.hazardPayType,
          employee.insalubrityPct,
          yearMonth,
        )
      : null;
    if (hazard) {
      items.push({
        kind: PayrollLineItemKind.EARNING,
        code: hazard.code,
        description: hazard.description,
        amount: hazard.amount,
      });
      payrollBaseDisplay = roundMoney(baseSalary + hazard.amount);
    }

    const variableEarnings = buildVariableEarnings({
      payrollBaseForHour: payrollBaseDisplay ?? baseSalary,
      monthlyWorkHours: employee?.monthlyWorkHours ?? 220,
      yearMonth,
      otHours50: lineVars.otHours50,
      otHours100: lineVars.otHours100,
      commissionAmount: lineVars.commissionAmount,
      ajudaCustoAmount: lineVars.ajudaCustoAmount,
    });
    for (const v of variableEarnings) {
      items.push({
        kind: PayrollLineItemKind.EARNING,
        code: v.code,
        description: v.description,
        amount: v.amount,
      });
    }

    const leaves = await prisma.leaveAbsence.findMany({ where: { employeeId } });
    for (const leave of leaves) {
      const days = overlapDays(leave.startsAt, leave.endsAt, monthStart, monthEnd);
      if (days <= 0) continue;
      if (leave.type === 'MEDICAL') {
        items.push({
          kind: PayrollLineItemKind.DEDUCTION,
          code: 'ATESTADO',
          description: `Dias sem trabalho (atestado) — ${days} dia(s)`,
          amount: Number((dailyRate * days).toFixed(2)),
          sourceRef: leave.id,
        });
      }
    }

    const vacations = await prisma.vacationPlan.findMany({
      where: {
        employeeId,
        status: { in: [VacationStatus.PLANNED, VacationStatus.IN_PROGRESS, VacationStatus.DONE] },
      },
    });
    for (const vac of vacations) {
      const days = overlapDays(vac.startsAt, vac.endsAt, monthStart, monthEnd);
      if (days <= 0) continue;
      const vacationPay = dailyRate * days;
      const third = vacationPay / 3;
      items.push({
        kind: PayrollLineItemKind.EARNING,
        code: 'FERIAS',
        description: `Salário férias — ${days} dia(s)`,
        amount: Number(vacationPay.toFixed(2)),
        sourceRef: vac.id,
      });
      items.push({
        kind: PayrollLineItemKind.EARNING,
        code: 'FERIAS_1_3',
        description: `1/3 constitucional férias — ${days} dia(s)`,
        amount: Number(third.toFixed(2)),
        sourceRef: vac.id,
      });
    }

    const withdrawals = await prisma.employeeProductWithdrawal.findMany({
      where: {
        employeeId,
        status: EmployeeWithdrawalStatus.PENDING,
        withdrawnAt: { gte: monthStart, lte: new Date(monthEnd.getTime() + 86400000 - 1) },
      },
      include: { product: true },
    });
    for (const w of withdrawals) {
      items.push({
        kind: PayrollLineItemKind.DEDUCTION,
        code: 'RET_PROD',
        description: `Retirada ${w.product.sku} — ${Number(w.quantity)} un`,
        amount: Number(w.totalAmount),
        sourceRef: w.id,
      });
    }

    if (employee?.workShift) {
      const punches = await prisma.timeClockPunch.findMany({
        where: {
          employeeId,
          punchedAt: { gte: monthStart, lte: new Date(monthEnd.getTime() + 86400000 - 1) },
        },
        orderBy: { punchedAt: 'asc' },
      });
      const expectedMin = shiftExpectedMinutes(
        employee.workShift.startTime,
        employee.workShift.endTime,
        employee.workShift.breakMinutes,
      );
      let workedMin = 0;
      for (let i = 0; i < punches.length - 1; i++) {
        if (punches[i].type === 'IN' && punches[i + 1].type === 'OUT') {
          workedMin += (punches[i + 1].punchedAt.getTime() - punches[i].punchedAt.getTime()) / 60000;
        }
      }
      const weekdays = Math.max(Math.floor((monthEnd.getTime() - monthStart.getTime()) / 86400000) + 1, 1);
      const expectedTotal = expectedMin * Math.min(weekdays, 22);
      if (expectedTotal > 0 && workedMin < expectedTotal * 0.9) {
        const missingHours = (expectedTotal - workedMin) / 60;
        const hourly = baseSalary / 220;
        items.push({
          kind: PayrollLineItemKind.DEDUCTION,
          code: 'PONTO',
          description: `Horas abaixo do turno (${missingHours.toFixed(1)} h estim.)`,
          amount: Number((missingHours * hourly).toFixed(2)),
        });
      }
    }

    if (employee?.vtOptIn) {
      items.push({
        kind: PayrollLineItemKind.DEDUCTION,
        code: 'VT',
        description: 'Vale-transporte (6% sobre salário contratual)',
        amount: roundMoney(baseSalary * 0.06),
      });
    }

    const earnings = items.filter((i) => i.kind === PayrollLineItemKind.EARNING);
    const otherDeductions = items.filter((i) => i.kind === PayrollLineItemKind.DEDUCTION);
    const dependents = employee?.irrfDependents ?? 0;
    const rubrics = await this.rubricIncidenceMap(
      prisma,
      earnings.map((e) => e.code),
    );
    const { lines: statutoryLines } = buildStatutoryDeductionLinesFromEarnings(
      baseSalary,
      earnings.map((e) => ({ code: e.code, amount: e.amount })),
      rubrics,
      yearMonth,
      dependents,
    );
    const statutory: typeof items = statutoryLines.map((s) => ({
      kind: PayrollLineItemKind.DEDUCTION,
      code: s.code,
      description: s.description,
      amount: s.amount,
    }));

    items.length = 0;
    items.push(...earnings, ...statutory, ...otherDeductions);

    return { items, payrollBaseDisplay };
  }

  private async applyPendingWithdrawalsToRun(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    run: {
      yearMonth: string;
      lines: {
        id: string;
        employeeId: string;
        baseSalary: { toString(): string } | number;
        additions: { toString(): string } | number;
        deductions: { toString(): string } | number;
        items: { code: string; sourceRef: string | null }[];
      }[];
    },
  ) {
    const { start: monthStart, end: monthEnd } = monthBounds(run.yearMonth);
    const monthEndTs = new Date(monthEnd.getTime() + 86400000 - 1);

    for (const line of run.lines) {
      const existingRetRefs = new Set(
        line.items
          .filter((i) => i.code === 'RET_PROD' && i.sourceRef)
          .map((i) => i.sourceRef as string),
      );

      const pending = await prisma.employeeProductWithdrawal.findMany({
        where: {
          employeeId: line.employeeId,
          status: EmployeeWithdrawalStatus.PENDING,
          withdrawnAt: { gte: monthStart, lte: monthEndTs },
        },
        include: { product: true },
      });

      let extraDeduction = 0;
      for (const w of pending) {
        if (!existingRetRefs.has(w.id)) {
          await prisma.payrollLineItem.create({
            data: {
              payrollLineId: line.id,
              kind: PayrollLineItemKind.DEDUCTION,
              code: 'RET_PROD',
              description: `Retirada ${w.product.sku} — ${Number(w.quantity)} un`,
              amount: w.totalAmount,
              sourceRef: w.id,
            },
          });
          extraDeduction += Number(w.totalAmount);
        }
        await prisma.employeeProductWithdrawal.update({
          where: { id: w.id },
          data: { status: EmployeeWithdrawalStatus.APPLIED, payrollLineId: line.id },
        });
      }

      if (extraDeduction > 0) {
        const deductions = Number(line.deductions) + extraDeduction;
        const netPay = Number(line.baseSalary) + Number(line.additions) - deductions;
        await prisma.payrollLine.update({
          where: { id: line.id },
          data: { deductions, netPay },
        });
      }
    }
  }

  async createPayrollRun(user: JwtPayload, yearMonth: string) {
    const prisma = await this.db(user);
    await this.payrollRubrics.ensureSystemRubrics(user);
    const exists = await prisma.payrollRun.findUnique({ where: { yearMonth } });
    if (exists) throw new BadRequestException('Competência já existe');
    const { start: monthStart, end: monthEnd } = monthBounds(yearMonth);
    const employees = await prisma.employee.findMany({ where: { isActive: true } });

    const run = await prisma.payrollRun.create({ data: { yearMonth } });

    for (const e of employees) {
      const base = Number(e.baseSalary);
      const { items: itemDrafts, payrollBaseDisplay } = await this.buildPayrollItemsForEmployee(
        prisma,
        e.id,
        base,
        yearMonth,
        monthStart,
        monthEnd,
      );
      const additions = itemDrafts
        .filter((i) => i.kind === PayrollLineItemKind.EARNING)
        .reduce((s, i) => s + i.amount, 0);
      const deductions = itemDrafts
        .filter((i) => i.kind === PayrollLineItemKind.DEDUCTION)
        .reduce((s, i) => s + i.amount, 0);
      const netPay = base + additions - deductions;
      const rubricMap = await this.payrollRubrics.assertCodesExist(
        user,
        itemDrafts.map((i) => i.code),
      );

      const line = await prisma.payrollLine.create({
        data: {
          payrollRunId: run.id,
          employeeId: e.id,
          baseSalary: base,
          payrollBaseDisplay,
          additions,
          deductions,
          netPay,
          items: {
            create: itemDrafts.map((i) => ({
              kind: i.kind,
              code: i.code,
              description: i.description,
              amount: i.amount,
              sourceRef: i.sourceRef,
              rubricId: rubricMap.get(i.code) ?? undefined,
            })),
          },
        },
      });

      for (const item of itemDrafts) {
        if (item.code === 'RET_PROD' && item.sourceRef) {
          await prisma.employeeProductWithdrawal.updateMany({
            where: { id: item.sourceRef, status: EmployeeWithdrawalStatus.PENDING },
            data: { status: EmployeeWithdrawalStatus.APPLIED, payrollLineId: line.id },
          });
        }
      }
    }

    return prisma.payrollRun.findUnique({
      where: { id: run.id },
      include: { lines: { include: { employee: true, items: true } } },
    });
  }

  async closePayrollRun(user: JwtPayload, id: string) {
    const prisma = await this.db(user);
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { items: true } } },
    });
    if (!run) throw new NotFoundException('Folha não encontrada');
    if (run.status === PayrollRunStatus.CLOSED) {
      throw new BadRequestException('Folha já fechada');
    }
    await this.applyPendingWithdrawalsToRun(prisma, run);
    const refreshed = await prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { items: true } } },
    });
    if (refreshed) await this.syncPayrollStatutoryTaxes(prisma, refreshed);
    const paymentDate =
      refreshed?.paymentDate ??
      new Date(new Date().toISOString().slice(0, 10) + 'T12:00:00.000Z');
    return prisma.payrollRun.update({
      where: { id },
      data: { status: PayrollRunStatus.CLOSED, paymentDate },
      include: { lines: { include: { employee: true, items: true } } },
    });
  }

  async updatePayrollRun(
    user: JwtPayload,
    id: string,
    data: { paymentDate?: string | null },
  ) {
    const prisma = await this.db(user);
    const run = await prisma.payrollRun.findUnique({ where: { id } });
    if (!run) throw new NotFoundException('Folha não encontrada');
    return prisma.payrollRun.update({
      where: { id },
      data: {
        ...(data.paymentDate !== undefined
          ? {
              paymentDate: data.paymentDate
                ? new Date(`${String(data.paymentDate).slice(0, 10)}T12:00:00.000Z`)
                : null,
            }
          : {}),
      },
      include: { lines: { include: { employee: true, items: true } } },
    });
  }

  private async syncPayrollStatutoryTaxes(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    run: { id: string; yearMonth: string; lines: { id: string; employeeId: string; baseSalary: unknown; additions: unknown; items: { id: string; code: string }[] }[] },
  ) {
    for (const line of run.lines) {
      const employee = await prisma.employee.findUnique({
        where: { id: line.employeeId },
        select: { irrfDependents: true },
      });
      const base = Number(line.baseSalary);
      const allItems = await prisma.payrollLineItem.findMany({
        where: { payrollLineId: line.id },
      });
      const earnings = allItems
        .filter((i) => i.kind === PayrollLineItemKind.EARNING)
        .map((i) => ({ code: i.code, amount: Number(i.amount) }));
      const rubrics = await this.rubricIncidenceMap(
        prisma,
        earnings.map((e) => e.code),
      );
      const { lines: statutoryLines } = buildStatutoryDeductionLinesFromEarnings(
        base,
        earnings,
        rubrics,
        run.yearMonth,
        employee?.irrfDependents ?? 0,
      );

      await prisma.payrollLineItem.deleteMany({
        where: { payrollLineId: line.id, code: { in: ['INSS', 'IRRF'] } },
      });
      for (const s of statutoryLines) {
        const rubric = await prisma.payrollRubric.findUnique({ where: { code: s.code } });
        await prisma.payrollLineItem.create({
          data: {
            payrollLineId: line.id,
            kind: PayrollLineItemKind.DEDUCTION,
            code: s.code,
            description: s.description,
            amount: s.amount,
            rubricId: rubric?.id,
          },
        });
      }

      const refreshedItems = await prisma.payrollLineItem.findMany({
        where: { payrollLineId: line.id },
      });
      const additions = refreshedItems
        .filter((i) => i.kind === PayrollLineItemKind.EARNING)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const deductions = refreshedItems
        .filter((i) => i.kind === PayrollLineItemKind.DEDUCTION)
        .reduce((sum, i) => sum + Number(i.amount), 0);
      const netPay = base + additions - deductions;
      await prisma.payrollLine.update({
        where: { id: line.id },
        data: { additions, deductions, netPay },
      });
    }
  }

  async syncPayrollWithdrawals(user: JwtPayload, id: string) {
    const prisma = await this.db(user);
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { items: true } } },
    });
    if (!run) throw new NotFoundException('Folha não encontrada');
    await this.applyPendingWithdrawalsToRun(prisma, run);
    const refreshed = await prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { items: true } } },
    });
    if (refreshed) await this.syncPayrollStatutoryTaxes(prisma, refreshed);
    return prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { employee: true, items: true } } },
    });
  }

  async syncPayrollTaxes(user: JwtPayload, id: string) {
    const prisma = await this.db(user);
    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { items: true } } },
    });
    if (!run) throw new NotFoundException('Folha não encontrada');
    await this.syncPayrollStatutoryTaxes(prisma, run);
    return prisma.payrollRun.findUnique({
      where: { id },
      include: { lines: { include: { employee: true, items: true } } },
    });
  }

  async rebuildPayrollLine(
    user: JwtPayload,
    lineId: string,
    data: {
      otHours50?: number;
      otHours100?: number;
      commissionAmount?: number;
      ajudaCustoAmount?: number;
    },
  ) {
    const prisma = await this.db(user);
    await this.payrollRubrics.ensureSystemRubrics(user);
    const line = await prisma.payrollLine.findUnique({
      where: { id: lineId },
      include: { payrollRun: true },
    });
    if (!line) throw new NotFoundException('Linha não encontrada');
    if (line.payrollRun.status === PayrollRunStatus.CLOSED) {
      throw new BadRequestException('Folha fechada');
    }

    const lineVars = {
      otHours50: data.otHours50 ?? Number(line.otHours50),
      otHours100: data.otHours100 ?? Number(line.otHours100),
      commissionAmount: data.commissionAmount ?? Number(line.commissionAmount),
      ajudaCustoAmount: data.ajudaCustoAmount ?? Number(line.ajudaCustoAmount),
    };

    const { start: monthStart, end: monthEnd } = monthBounds(line.payrollRun.yearMonth);
    const base = Number(line.baseSalary);
    const { items: itemDrafts, payrollBaseDisplay } = await this.buildPayrollItemsForEmployee(
      prisma,
      line.employeeId,
      base,
      line.payrollRun.yearMonth,
      monthStart,
      monthEnd,
      lineVars,
    );

    await prisma.payrollLineItem.deleteMany({ where: { payrollLineId: line.id } });
    const rubricMap = await this.payrollRubrics.assertCodesExist(
      user,
      itemDrafts.map((i) => i.code),
    );
    for (const i of itemDrafts) {
      await prisma.payrollLineItem.create({
        data: {
          payrollLineId: line.id,
          kind: i.kind,
          code: i.code,
          description: i.description,
          amount: i.amount,
          sourceRef: i.sourceRef,
          rubricId: rubricMap.get(i.code),
        },
      });
    }

    const additions = itemDrafts
      .filter((i) => i.kind === PayrollLineItemKind.EARNING)
      .reduce((s, i) => s + i.amount, 0);
    const deductions = itemDrafts
      .filter((i) => i.kind === PayrollLineItemKind.DEDUCTION)
      .reduce((s, i) => s + i.amount, 0);
    const netPay = base + additions - deductions;

    return prisma.payrollLine.update({
      where: { id: line.id },
      data: {
        otHours50: lineVars.otHours50,
        otHours100: lineVars.otHours100,
        commissionAmount: lineVars.commissionAmount,
        ajudaCustoAmount: lineVars.ajudaCustoAmount,
        payrollBaseDisplay,
        additions,
        deductions,
        netPay,
      },
      include: { employee: true, items: true },
    });
  }

  updatePayrollLine(
    user: JwtPayload,
    lineId: string,
    data: {
      additions?: number;
      deductions?: number;
      otHours50?: number;
      otHours100?: number;
      commissionAmount?: number;
      ajudaCustoAmount?: number;
      recalculate?: boolean;
    },
  ) {
    if (data.recalculate || data.otHours50 !== undefined || data.otHours100 !== undefined ||
        data.commissionAmount !== undefined || data.ajudaCustoAmount !== undefined) {
      return this.rebuildPayrollLine(user, lineId, data);
    }
    return this.db(user).then(async (p) => {
      const line = await p.payrollLine.findUnique({ where: { id: lineId }, include: { payrollRun: true } });
      if (!line) throw new NotFoundException();
      if (line.payrollRun.status === PayrollRunStatus.CLOSED) throw new BadRequestException('Folha fechada');
      const additions = data.additions ?? Number(line.additions);
      const deductions = data.deductions ?? Number(line.deductions);
      const netPay = Number(line.baseSalary) + additions - deductions;
      return p.payrollLine.update({ where: { id: lineId }, data: { additions, deductions, netPay } });
    });
  }

  listTerminals(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.timeClockTerminal.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
    );
  }

  createTerminal(user: JwtPayload, name: string) {
    const secret = randomBytes(16).toString('hex');
    return this.db(user).then((p) => p.timeClockTerminal.create({ data: { name, deviceSecret: secret } }));
  }

  updateTerminal(user: JwtPayload, id: string, data: { name?: string; isActive?: boolean }) {
    return this.db(user).then((p) => p.timeClockTerminal.update({ where: { id }, data }));
  }

  deleteTerminal(user: JwtPayload, id: string) {
    return this.db(user).then((p) => p.timeClockTerminal.delete({ where: { id } }));
  }

  private async issueTerminalQr(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    terminalId: string,
  ) {
    const token = randomBytes(12).toString('hex');
    const hash = createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 90_000);
    const terminal = await prisma.timeClockTerminal.update({
      where: { id: terminalId },
      data: { qrToken: hash, qrExpiresAt: expires, lastSeenAt: new Date() },
      select: { id: true, name: true },
    });
    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      token,
      expiresAt: expires.toISOString(),
    };
  }

  async refreshTerminalQr(user: JwtPayload, terminalId: string) {
    const prisma = await this.db(user);
    const terminal = await prisma.timeClockTerminal.findUnique({ where: { id: terminalId } });
    if (!terminal) throw new NotFoundException('Terminal não encontrado');
    if (!terminal.isActive) throw new BadRequestException('Terminal inativo');
    return this.issueTerminalQr(prisma, terminalId);
  }

  async refreshTerminalQrPublic(tenantSlug: string, terminalId: string, deviceSecret: string) {
    await this.tenantService.assertLicenseActive(tenantSlug);
    await this.tenantService.assertPlanTimeClock(tenantSlug);
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    const terminal = await prisma.timeClockTerminal.findUnique({ where: { id: terminalId } });
    if (!terminal) throw new NotFoundException('Terminal não encontrado');
    if (!terminal.isActive) throw new BadRequestException('Terminal inativo');
    if (terminal.deviceSecret !== deviceSecret) {
      throw new UnauthorizedException('Segredo do terminal inválido');
    }
    return this.issueTerminalQr(prisma, terminalId);
  }

  async getTerminalKioskConfig(user: JwtPayload, terminalId: string) {
    const prisma = await this.db(user);
    const terminal = await prisma.timeClockTerminal.findUnique({ where: { id: terminalId } });
    if (!terminal) throw new NotFoundException('Terminal não encontrado');
    const q = new URLSearchParams({
      tenant: user.tenantSlug,
      terminalId: terminal.id,
      secret: terminal.deviceSecret,
      name: terminal.name,
    });
    return {
      terminalId: terminal.id,
      terminalName: terminal.name,
      tenantSlug: user.tenantSlug,
      quiosquePath: `/rh/ponto/quiosque?${q.toString()}`,
    };
  }

  async punch(user: JwtPayload, data: { token: string; terminalId: string; source: 'KIOSK' | 'MOBILE' }) {
    const prisma = await this.db(user);
    const terminal = await prisma.timeClockTerminal.findUnique({ where: { id: data.terminalId } });
    if (!terminal?.isActive) throw new BadRequestException('Terminal inativo');
    if (!terminal.qrToken || !terminal.qrExpiresAt || terminal.qrExpiresAt < new Date()) {
      throw new BadRequestException('QR expirado — atualize na portaria');
    }
    const hash = createHash('sha256').update(data.token).digest('hex');
    if (hash !== terminal.qrToken) throw new BadRequestException('QR inválido');
    const employee = await prisma.employee.findFirst({ where: { userId: user.sub, isActive: true } });
    if (!employee) throw new BadRequestException('Funcionário não vinculado ao usuário');
    const last = await prisma.timeClockPunch.findFirst({
      where: { employeeId: employee.id },
      orderBy: { punchedAt: 'desc' },
    });
    if (last && Date.now() - last.punchedAt.getTime() < 30_000) {
      throw new BadRequestException('Aguarde 30 segundos entre batidas');
    }
    const type = last?.type === 'IN' ? 'OUT' : 'IN';
    return prisma.timeClockPunch.create({
      data: { employeeId: employee.id, type, source: data.source, terminalId: data.terminalId },
    });
  }

  listPunches(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.timeClockPunch.findMany({
        take: 500,
        orderBy: { punchedAt: 'desc' },
        include: { employee: true },
      }),
    );
  }
}
