import { Injectable, NotFoundException } from '@nestjs/common';
import { readCompanyLogoDataUrl } from '../cadastros/company-logo.util';
import {
  applyWithdrawalPayslipDisplay,
  buildStatutoryDeductionLinesFromEarnings,
  roundMoney,
  type RubricIncidence,
} from './hr-payroll-taxes';
import { calendarDaysInMonth, mergePayslipFields } from './hr-payslip-fields';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  buildEmployeePunchMirrors,
  formatMinutesAsHours,
  formatPunchTime,
  type PunchRow,
} from './hr-punch-mirror.util';

@Injectable()
export class HrReportsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private db(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  private punchWhere(from?: string, to?: string) {
    const where: { punchedAt?: { gte?: Date; lte?: Date } } = {};
    if (from) where.punchedAt = { ...where.punchedAt, gte: new Date(`${from.slice(0, 10)}T00:00:00.000Z`) };
    if (to) {
      const t = new Date(`${to.slice(0, 10)}T23:59:59.999Z`);
      where.punchedAt = { ...where.punchedAt, lte: t };
    }
    return where;
  }

  async punchMirrorDocument(user: JwtPayload, from?: string, to?: string) {
    const prisma = await this.db(user);
    const company = await prisma.company.findFirst();
    const punches = await prisma.timeClockPunch.findMany({
      where: this.punchWhere(from, to),
      orderBy: { punchedAt: 'asc' },
      include: { employee: true },
    });
    const punchRows: PunchRow[] = punches.map((p) => ({
      employeeId: p.employeeId,
      employeeName: p.employee.name,
      jobTitle: p.employee.jobTitle,
      punchedAt: p.punchedAt,
      type: p.type,
      source: p.source,
    }));
    const employees = buildEmployeePunchMirrors(punchRows);
    const rows = punches.map((p) => ({
      label: `${p.employee.name} — ${formatPunchTime(p.punchedAt)}`,
      value: `${p.type} (${p.source})`,
    }));
    return {
      title: 'Espelho de ponto',
      reportKey: 'rh-ponto',
      companyName: company?.tradeName ?? company?.legalName ?? 'Granja',
      from: from?.slice(0, 10) ?? '',
      to: to?.slice(0, 10) ?? '',
      generatedAt: new Date().toISOString(),
      employees,
      totals: {
        employees: employees.length,
        punches: punches.length,
        minutes: employees.reduce((s, e) => s + e.totalMinutes, 0),
        hoursLabel: formatMinutesAsHours(employees.reduce((s, e) => s + e.totalMinutes, 0)),
      },
      rows,
    };
  }

  async punchReport(user: JwtPayload, from?: string, to?: string) {
    return this.punchMirrorDocument(user, from, to);
  }

  async payrollReport(user: JwtPayload, runId: string) {
    const prisma = await this.db(user);
    const company = await prisma.company.findFirst();
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        lines: {
          include: { employee: true, items: true },
        },
      },
    });
    if (!run) throw new NotFoundException('Folha não encontrada');
    const rows: { label: string; value: string }[] = [];
    for (const line of run.lines) {
      rows.push({
        label: `${line.employee.name} — Base`,
        value: `R$ ${Number(line.baseSalary).toFixed(2)}`,
      });
      for (const item of line.items) {
        rows.push({
          label: `  ${item.description}`,
          value: `${item.kind === 'EARNING' ? '+' : '-'} R$ ${Number(item.amount).toFixed(2)}`,
        });
      }
      rows.push({
        label: `${line.employee.name} — Líquido`,
        value: `R$ ${Number(line.netPay).toFixed(2)}`,
      });
    }
    return {
      title: `Folha de pagamento ${run.yearMonth}`,
      reportKey: 'rh-folha',
      companyName: company?.tradeName ?? company?.legalName ?? 'Granja',
      from: run.yearMonth,
      to: run.status,
      generatedAt: new Date().toISOString(),
      rows,
    };
  }

  async payrollPrintDocument(user: JwtPayload, runId: string) {
    const prisma = await this.db(user);
    const company = await prisma.company.findFirst();
    const run = await prisma.payrollRun.findUnique({
      where: { id: runId },
      include: {
        lines: {
          include: { employee: true, items: true },
          orderBy: { employee: { name: 'asc' } },
        },
      },
    });
    if (!run) throw new NotFoundException('Folha não encontrada');

    let hrSettings = await prisma.hrSettings.findUnique({ where: { id: 'default' } });
    if (!hrSettings) {
      hrSettings = await prisma.hrSettings.create({ data: { id: 'default' } });
    }
    const detailWithdrawalsOnPayslip = hrSettings.detailWithdrawalsOnPayslip;
    const payslipFields = mergePayslipFields(hrSettings.payslipFields);
    const calendarDays = calendarDaysInMonth(run.yearMonth);

    const earningCodes = [
      ...new Set(
        run.lines.flatMap((l) =>
          l.items.filter((i) => i.kind === 'EARNING').map((i) => i.code),
        ),
      ),
    ];
    const rubricRows = earningCodes.length
      ? await prisma.payrollRubric.findMany({
          where: { code: { in: earningCodes } },
          select: {
            code: true,
            integratesInss: true,
            integratesFgts: true,
            integratesIrrf: true,
          },
        })
      : [];
    const rubricByCode = new Map<string, RubricIncidence>(
      rubricRows.map((r) => [
        r.code,
        {
          integratesInss: r.integratesInss,
          integratesFgts: r.integratesFgts,
          integratesIrrf: r.integratesIrrf,
        },
      ]),
    );

    const slips = run.lines.map((line) => {
      const emp = line.employee;
      const earnings = [
        { code: 'SAL_BASE', description: 'Salário base', amount: Number(line.baseSalary) },
        ...line.items
          .filter((i) => i.kind === 'EARNING')
          .map((i) => ({
            code: i.code,
            description: i.description,
            amount: Number(i.amount),
          })),
      ];
      const storedDeductions = line.items
        .filter((i) => i.kind === 'DEDUCTION')
        .map((i) => ({
          code: i.code,
          description: i.description,
          amount: Number(i.amount),
        }));
      const totalEarnings = earnings.reduce((s, i) => s + i.amount, 0);
      const earningsForTax = line.items
        .filter((i) => i.kind === 'EARNING')
        .map((i) => ({ code: i.code, amount: Number(i.amount) }));
      const rubrics = new Map<string, RubricIncidence>();
      for (const e of earningsForTax) {
        const row = rubricByCode.get(e.code);
        if (row) rubrics.set(e.code, row);
      }
      const statutory = buildStatutoryDeductionLinesFromEarnings(
        Number(line.baseSalary),
        earningsForTax,
        rubrics,
        run.yearMonth,
        emp.irrfDependents ?? 0,
      );
      const otherDeductions = storedDeductions.filter((i) => i.code !== 'INSS' && i.code !== 'IRRF');
      const deductionItemsRaw = [...statutory.lines, ...otherDeductions];
      const totalDeductionItems = roundMoney(deductionItemsRaw.reduce((s, i) => s + i.amount, 0));
      const netPay = roundMoney(Math.max(0, totalEarnings - totalDeductionItems));
      const display = applyWithdrawalPayslipDisplay(deductionItemsRaw, detailWithdrawalsOnPayslip);
      const footerBase =
        line.payrollBaseDisplay != null ? Number(line.payrollBaseDisplay) : Number(line.baseSalary);
      return {
        employeeName: emp.name,
        jobTitle: emp.jobTitle,
        cpf: emp.cpf,
        controlNumber: emp.controlNumber,
        pisPasep: emp.pisPasep,
        hiredAt: emp.hiredAt ? emp.hiredAt.toISOString().slice(0, 10) : null,
        bankCode: emp.bankCode,
        bankAgency: emp.bankAgency,
        bankAccount: emp.bankAccount,
        bankAccountDigit: emp.bankAccountDigit,
        baseSalary: footerBase,
        additions: Number(line.additions),
        deductions: totalDeductionItems,
        netPay,
        earnings,
        deductionItems: display.deductionItems,
        withdrawalDetailAppendix: display.withdrawalDetailAppendix,
        totalEarnings,
        totalDeductionItems,
        inss: statutory.inss,
        irrf: statutory.irrf,
        fgtsEmployer: statutory.fgtsEmployer,
        taxTablesLabel: statutory.tables.label,
        grossRemuneration: statutory.taxBases.grossRemuneration,
        taxBases: statutory.taxBases,
        calendarDays,
      };
    });

    const summary = {
      headcount: slips.length,
      totalBase: slips.reduce((s, x) => s + x.baseSalary, 0),
      totalAdditions: slips.reduce((s, x) => s + x.additions, 0),
      totalDeductions: slips.reduce((s, x) => s + x.deductions, 0),
      totalNet: slips.reduce((s, x) => s + x.netPay, 0),
    };

    const logoDataUrl = await readCompanyLogoDataUrl(user.tenantSlug);

    const missingPis = slips.filter((s) => !s.pisPasep).map((s) => s.employeeName);

    return {
      generatedAt: new Date().toISOString(),
      logoDataUrl,
      company: company
        ? {
            legalName: company.legalName,
            tradeName: company.tradeName,
            cnpj: company.cnpj,
            address: company.address,
            city: company.city,
            state: company.state,
            zipCode: company.zipCode,
            phone: company.phone,
            email: company.email,
          }
        : null,
      run: {
        id: run.id,
        yearMonth: run.yearMonth,
        status: run.status,
        paymentDate: run.paymentDate ? run.paymentDate.toISOString().slice(0, 10) : null,
      },
      payslipDisplay: {
        detailWithdrawalsOnPayslip,
        fields: payslipFields,
      },
      printWarnings:
        missingPis.length > 0 && payslipFields.showPis
          ? [`PIS/PASEP não informado: ${missingPis.join(', ')}`]
          : [],
      slips,
      summary,
    };
  }
}
