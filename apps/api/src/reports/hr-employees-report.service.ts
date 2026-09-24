import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type HrEmployeesReportVariant = 'listagem_geral';

export type HrEmployeesReportSort = 'controle' | 'nome' | 'salario_asc' | 'salario_desc';

export type HrEmployeesReportQuery = {
  variant: HrEmployeesReportVariant;
  controlMin?: number;
  controlMax?: number;
  sort: HrEmployeesReportSort;
};

function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

@Injectable()
export class HrEmployeesReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: HrEmployeesReportQuery) {
    if (query.variant !== 'listagem_geral') {
      throw new BadRequestException('variant inválido');
    }

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const where: Prisma.EmployeeWhereInput = {};
    if (query.controlMin != null || query.controlMax != null) {
      where.controlNumber = {};
      if (query.controlMin != null) (where.controlNumber as Prisma.IntFilter).gte = query.controlMin;
      if (query.controlMax != null) (where.controlNumber as Prisma.IntFilter).lte = query.controlMax;
    }

    const orderBy: Prisma.EmployeeOrderByWithRelationInput[] =
      query.sort === 'nome'
        ? [{ name: 'asc' }]
        : query.sort === 'salario_asc'
          ? [{ baseSalary: 'asc' }, { name: 'asc' }]
          : query.sort === 'salario_desc'
            ? [{ baseSalary: 'desc' }, { name: 'asc' }]
            : [{ controlNumber: 'asc' }];

    const employees = await prisma.employee.findMany({
      where,
      include: {
        user: { select: { username: true } },
      },
      orderBy,
    });

    const rows = employees.map((e) => ({
      controlNumber: e.controlNumber,
      name: e.name,
      cpf: e.cpf,
      jobTitle: e.jobTitle,
      baseSalary: dec(e.baseSalary),
      irrfDependents: e.irrfDependents,
      hiredAt: e.hiredAt?.toISOString().slice(0, 10) ?? null,
      isActive: e.isActive,
      username: e.user?.username ?? null,
    }));

    const totals = rows.reduce(
      (acc, r) => {
        acc.count += 1;
        acc.totalSalary += r.baseSalary;
        if (r.isActive) acc.activeCount += 1;
        return acc;
      },
      { count: 0, activeCount: 0, totalSalary: 0 },
    );

    return {
      variant: query.variant,
      sort: query.sort,
      filters: {
        controlMin: query.controlMin ?? null,
        controlMax: query.controlMax ?? null,
      },
      totals,
      rows,
    };
  }
}
