import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollRubricKind } from '../generated/tenant-client';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/** Rubricas padrão alinhadas aos códigos gerados pela folha (referência eSocial S-1010). */
export const SYSTEM_PAYROLL_RUBRICS: {
  code: string;
  description: string;
  kind: PayrollRubricKind;
  natureCode: string;
  incidenceCp: string;
  incidenceFgts: string;
  incidenceIrrf: string;
  integratesInss?: boolean;
  integratesFgts?: boolean;
  integratesIrrf?: boolean;
}[] = [
  {
    code: 'SAL_BASE',
    description: 'Salário base',
    kind: 'EARNING',
    natureCode: '1000',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'FERIAS',
    description: 'Férias',
    kind: 'EARNING',
    natureCode: '1020',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'FERIAS_1_3',
    description: '1/3 constitucional de férias',
    kind: 'EARNING',
    natureCode: '1020',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'INSS',
    description: 'Contribuição previdenciária (empregado)',
    kind: 'DEDUCTION',
    natureCode: '9201',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '09',
  },
  {
    code: 'IRRF',
    description: 'Imposto de renda retido na fonte',
    kind: 'DEDUCTION',
    natureCode: '9203',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
  },
  {
    code: 'ATESTADO',
    description: 'Desconto por atestado médico',
    kind: 'DEDUCTION',
    natureCode: '9207',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
  },
  {
    code: 'RET_PROD',
    description: 'Retirada de produtos',
    kind: 'DEDUCTION',
    natureCode: '9207',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
  },
  {
    code: 'PONTO',
    description: 'Desconto por horas não trabalhadas',
    kind: 'DEDUCTION',
    natureCode: '9207',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
  },
  {
    code: 'FGTS_PAT',
    description: 'FGTS — encargo patronal (informativo)',
    kind: 'INFORMATIVE',
    natureCode: '3501',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
  },
  {
    code: 'INSALUB',
    description: 'Adicional de insalubridade',
    kind: 'EARNING',
    natureCode: '1030',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'PERIC',
    description: 'Adicional de periculosidade',
    kind: 'EARNING',
    natureCode: '1030',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'HE_50',
    description: 'Hora extra (50%)',
    kind: 'EARNING',
    natureCode: '1003',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'HE_100',
    description: 'Hora extra (100%)',
    kind: 'EARNING',
    natureCode: '1003',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'DSR_HE',
    description: 'DSR sobre horas extras',
    kind: 'EARNING',
    natureCode: '1000',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'DSR_COM',
    description: 'DSR sobre comissões',
    kind: 'EARNING',
    natureCode: '1000',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'COMISS',
    description: 'Comissão',
    kind: 'EARNING',
    natureCode: '1010',
    incidenceCp: '11',
    incidenceFgts: '11',
    incidenceIrrf: '11',
  },
  {
    code: 'AJUDA_CUSTO',
    description: 'Ajuda de custo',
    kind: 'EARNING',
    natureCode: '1899',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
    integratesInss: false,
    integratesFgts: false,
    integratesIrrf: false,
  },
  {
    code: 'VT',
    description: 'Vale-transporte (6% salário)',
    kind: 'DEDUCTION',
    natureCode: '9207',
    incidenceCp: '00',
    incidenceFgts: '00',
    incidenceIrrf: '00',
    integratesInss: false,
    integratesFgts: false,
    integratesIrrf: false,
  },
];

@Injectable()
export class HrPayrollRubricsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private db(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  async ensureSystemRubrics(user: JwtPayload) {
    const prisma = await this.db(user);
    for (const r of SYSTEM_PAYROLL_RUBRICS) {
      const inc = {
        integratesInss: r.integratesInss ?? true,
        integratesFgts: r.integratesFgts ?? true,
        integratesIrrf: r.integratesIrrf ?? true,
      };
      await prisma.payrollRubric.upsert({
        where: { code: r.code },
        create: { ...r, ...inc, isSystem: true },
        update: inc,
      });
    }
  }

  async list(user: JwtPayload) {
    const prisma = await this.db(user);
    await this.ensureSystemRubrics(user);
    return prisma.payrollRubric.findMany({ orderBy: { code: 'asc' } });
  }

  async updateDescription(user: JwtPayload, id: string, description: string) {
    const prisma = await this.db(user);
    const row = await prisma.payrollRubric.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Rubrica não encontrada');
    if (row.isSystem) {
      return prisma.payrollRubric.update({
        where: { id },
        data: { description: description.trim() || row.description },
      });
    }
    return prisma.payrollRubric.update({
      where: { id },
      data: { description: description.trim() || row.description },
    });
  }

  async assertCodesExist(user: JwtPayload, codes: string[]) {
    const prisma = await this.db(user);
    await this.ensureSystemRubrics(user);
    const unique = [...new Set(codes)];
    const found = await prisma.payrollRubric.findMany({
      where: { code: { in: unique } },
      select: { code: true, id: true },
    });
    const map = new Map(found.map((f) => [f.code, f.id]));
    const missing = unique.filter((c) => !map.has(c));
    if (missing.length) {
      throw new BadRequestException(
        `Rubrica(s) não cadastrada(s): ${missing.join(', ')}. Cadastre em RH → Folha → Rubricas.`,
      );
    }
    return map;
  }
}
