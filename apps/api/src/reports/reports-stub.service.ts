import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from '../audit/audit.service';
import { HrReportsService } from '../hr/hr-reports.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class ReportsStubService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly hrReports: HrReportsService,
  ) {}

  async generate(
    user: JwtPayload,
    reportKey: string,
    query: { from?: string; to?: string; min?: string; max?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    const min = query.min ? Number(query.min) : null;
    const max = query.max ? Number(query.max) : null;

    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: 'REPORT',
      entity: reportKey,
      after: { from: query.from, to: query.to, min, max },
    });

    if (reportKey === 'rh-ponto') {
      return this.hrReports.punchReport(user, query.from, query.to);
    }
    if (reportKey === 'rh-folha' && query.min) {
      return this.hrReports.payrollReport(user, String(query.min));
    }
    if (reportKey === 'rh-atestados') {
      const leaves = await prisma.leaveAbsence.findMany({ include: { employee: true }, orderBy: { startsAt: 'desc' } });
      return {
        title: 'Atestados e afastamentos',
        reportKey,
        from: query.from ?? '',
        to: query.to ?? '',
        min: null,
        max: null,
        generatedAt: new Date().toISOString(),
        companyName: company?.tradeName ?? company?.legalName ?? 'Granja',
        rows: leaves.map((l) => ({
          label: `${l.employee.name} — ${l.startsAt.toISOString().slice(0, 10)} a ${l.endsAt.toISOString().slice(0, 10)}`,
          value: l.type === 'MEDICAL' ? 'Médico' : 'Outro',
        })),
      };
    }
    if (reportKey === 'rh-ferias') {
      const vacs = await prisma.vacationPlan.findMany({ include: { employee: true }, orderBy: { startsAt: 'desc' } });
      return {
        title: 'Férias programadas',
        reportKey,
        from: query.from ?? '',
        to: query.to ?? '',
        min: null,
        max: null,
        generatedAt: new Date().toISOString(),
        companyName: company?.tradeName ?? company?.legalName ?? 'Granja',
        rows: vacs.map((v) => ({
          label: `${v.employee.name} — ${v.startsAt.toISOString().slice(0, 10)} a ${v.endsAt.toISOString().slice(0, 10)}`,
          value: v.status,
        })),
      };
    }
    if (reportKey === 'rh-funcionarios') {
      const emps = await prisma.employee.findMany({ orderBy: { name: 'asc' } });
      return {
        title: 'Lista de funcionários',
        reportKey,
        from: '',
        to: '',
        min: null,
        max: null,
        generatedAt: new Date().toISOString(),
        companyName: company?.tradeName ?? company?.legalName ?? 'Granja',
        rows: emps.map((e) => ({
          label: e.name,
          value: `R$ ${Number(e.baseSalary).toFixed(2)} — ${e.isActive ? 'Ativo' : 'Inativo'}`,
        })),
      };
    }

    return {
      title: reportKey.replace(/-/g, ' '),
      reportKey,
      from: query.from ?? '',
      to: query.to ?? '',
      min: Number.isFinite(min) ? min : null,
      max: Number.isFinite(max) ? max : null,
      generatedAt: new Date().toISOString(),
      companyName: company?.tradeName ?? company?.legalName ?? 'Granja',
      rows: [
        { label: 'Relatório', value: reportKey },
        { label: 'Filtro período', value: `${query.from ?? '—'} até ${query.to ?? '—'}` },
        { label: 'Faixa numérica', value: `${min ?? '—'} — ${max ?? '—'}` },
        { label: 'Status', value: 'Modelo base — conteúdo a definir' },
      ],
    };
  }
}
