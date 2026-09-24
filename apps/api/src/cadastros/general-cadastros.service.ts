import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { loadCompanyBranding } from './company-branding.util';
import {
  allowedLogoMime,
  COMPANY_LOGO_API_PATH,
  COMPANY_LOGO_MAX_BYTES,
  resolveCompanyLogoPath,
  writeCompanyLogoFile,
} from './company-logo.util';
import { JwtPayload } from '../auth/jwt.strategy';
import {
  chartAccountAllowedForPayable,
  chartAccountAllowedForReceivable,
  chartAccountAllowedForStock,
} from '../finance/chart-account-flow';
import { ChartAccountType } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class GeneralCadastrosService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private db(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  listCities(user: JwtPayload) {
    return this.db(user).then((p) => p.city.findMany({ orderBy: [{ state: 'asc' }, { name: 'asc' }] }));
  }

  createCity(user: JwtPayload, data: { name: string; state: string; ibgeCode?: string }) {
    return this.db(user).then((p) =>
      p.city.create({ data: { name: data.name.trim(), state: data.state.trim().toUpperCase(), ibgeCode: data.ibgeCode } }),
    );
  }

  listDistricts(user: JwtPayload, cityId?: string) {
    return this.db(user).then((p) =>
      p.district.findMany({
        where: cityId ? { cityId } : undefined,
        include: { city: true },
        orderBy: { name: 'asc' },
      }),
    );
  }

  createDistrict(user: JwtPayload, data: { name: string; cityId: string }) {
    return this.db(user).then((p) => p.district.create({ data: { name: data.name.trim(), cityId: data.cityId } }));
  }

  listBanks(user: JwtPayload) {
    return this.db(user).then((p) => p.bank.findMany({ orderBy: { name: 'asc' } }));
  }

  createBank(user: JwtPayload, data: { compeCode: string; name: string }) {
    return this.db(user).then((p) =>
      p.bank.create({ data: { compeCode: data.compeCode.trim(), name: data.name.trim() } }),
    );
  }

  updateBank(user: JwtPayload, id: string, data: { name?: string; isActive?: boolean }) {
    return this.db(user).then((p) => p.bank.update({ where: { id }, data }));
  }

  listFiscalSituations(user: JwtPayload) {
    return this.db(user).then((p) => p.productFiscalSituation.findMany({ orderBy: { code: 'asc' } }));
  }

  createFiscalSituation(user: JwtPayload, data: { code: string; description: string }) {
    return this.db(user).then((p) =>
      p.productFiscalSituation.create({ data: { code: data.code.trim(), description: data.description.trim() } }),
    );
  }

  listStockLocations(user: JwtPayload) {
    return this.db(user).then((p) => p.stockLocation.findMany({ orderBy: { code: 'asc' } }));
  }

  createStockLocation(user: JwtPayload, data: { code: string; name: string; barnId?: string }) {
    return this.db(user).then((p) =>
      p.stockLocation.create({ data: { code: data.code.trim(), name: data.name.trim(), barnId: data.barnId } }),
    );
  }

  async getCompany(user: JwtPayload) {
    const p = await this.db(user);
    let c = await p.company.findFirst();
    if (!c) {
      c = await p.company.create({
        data: { legalName: 'Granja', cnpj: '00000000000000', tradeName: 'Granja' },
      });
    }
    const hasFile = resolveCompanyLogoPath(user.tenantSlug) != null;
    if (hasFile && !c.logoUrl) {
      c = await p.company.update({
        where: { id: c.id },
        data: { logoUrl: COMPANY_LOGO_API_PATH },
      });
    }
    if (!hasFile && c.logoUrl) {
      c = await p.company.update({
        where: { id: c.id },
        data: { logoUrl: null },
      });
    }
    return c;
  }

  async getCompanyBranding(user: JwtPayload) {
    const p = await this.db(user);
    return loadCompanyBranding(p, user.tenantSlug);
  }

  updateCompany(user: JwtPayload, data: Record<string, unknown>) {
    const { logoUrl: _drop, ...rest } = data;
    return this.getCompany(user).then((c) =>
      this.db(user).then((p) => p.company.update({ where: { id: c.id }, data: rest as never })),
    );
  }

  async uploadCompanyLogo(user: JwtPayload, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) throw new BadRequestException('Selecione um arquivo de imagem.');
    if (file.size > COMPANY_LOGO_MAX_BYTES) {
      throw new BadRequestException('Logo acima de 2 MB. Use uma imagem menor.');
    }
    if (!allowedLogoMime(file.mimetype)) {
      throw new BadRequestException('Formato inválido. Use PNG, JPG, WebP ou SVG.');
    }
    await writeCompanyLogoFile(user.tenantSlug, file.buffer, file.mimetype);
    return this.getCompany(user).then((c) =>
      this.db(user).then((p) =>
        p.company.update({
          where: { id: c.id },
          data: { logoUrl: COMPANY_LOGO_API_PATH },
        }),
      ),
    );
  }

  getCompanyLogoFilePath(user: JwtPayload): string | null {
    return resolveCompanyLogoPath(user.tenantSlug);
  }

  listWorkShifts(user: JwtPayload) {
    return this.db(user).then((p) => p.workShift.findMany({ orderBy: { code: 'asc' } }));
  }

  createWorkShift(
    user: JwtPayload,
    data: { code: string; name: string; startTime: string; endTime: string; breakMinutes?: number },
  ) {
    return this.db(user).then((p) =>
      p.workShift.create({
        data: {
          code: data.code.trim(),
          name: data.name.trim(),
          startTime: data.startTime,
          endTime: data.endTime,
          breakMinutes: data.breakMinutes ?? 60,
        },
      }),
    );
  }

  updateWorkShift(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return this.db(user).then((p) => p.workShift.update({ where: { id }, data: data as never }));
  }

  deleteWorkShift(user: JwtPayload, id: string) {
    return this.db(user).then(async (p) => {
      const linked = await p.employee.count({ where: { workShiftId: id } });
      if (linked > 0) throw new BadRequestException('Turno em uso por funcionários');
      await p.workShift.delete({ where: { id } });
      return { ok: true };
    });
  }

  async listChartAccounts(
    user: JwtPayload,
    opts?: { flow?: 'payable' | 'receivable' | 'stock'; postingOnly?: boolean },
  ) {
    const p = await this.db(user);
    const rows = await p.chartAccount.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });
    let filtered = rows;
    if (opts?.postingOnly) filtered = filtered.filter((r) => r.isPosting);
    if (opts?.flow === 'payable') {
      filtered = filtered.filter((r) =>
        chartAccountAllowedForPayable(r.code, r.type as ChartAccountType),
      );
    } else if (opts?.flow === 'receivable') {
      filtered = filtered.filter((r) =>
        chartAccountAllowedForReceivable(r.code, r.type as ChartAccountType),
      );
    } else if (opts?.flow === 'stock') {
      filtered = filtered.filter((r) =>
        chartAccountAllowedForStock(r.code, r.type as ChartAccountType),
      );
    }
    return filtered;
  }

  createChartAccount(
    user: JwtPayload,
    data: { code: string; name: string; type: string; parentId?: string; isPosting?: boolean },
  ) {
    return this.db(user).then((p) =>
      p.chartAccount.create({
        data: {
          code: data.code.trim(),
          name: data.name.trim(),
          type: data.type as 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE',
          parentId: data.parentId,
          isPosting: data.isPosting ?? true,
        },
      }),
    );
  }

  updateChartAccount(user: JwtPayload, id: string, data: Record<string, unknown>) {
    return this.db(user).then((p) => p.chartAccount.update({ where: { id }, data: data as never }));
  }

  deleteChartAccount(user: JwtPayload, id: string) {
    return this.db(user).then(async (p) => {
      const children = await p.chartAccount.count({ where: { parentId: id } });
      if (children > 0) throw new BadRequestException('Conta possui subcontas');
      await p.chartAccount.delete({ where: { id } });
      return { ok: true };
    });
  }
}
