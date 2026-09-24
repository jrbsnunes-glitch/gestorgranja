import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { timingSafeEqual } from 'crypto';
import { LicenseStatus, type Tenant } from '../generated/central-client';
import { buildActivateLicenseUpdate, extendLicenseExpiresAt } from '../commercial/license-ops';
import {
  COMMERCIAL_PLANS,
  type CommercialPlanCode,
  planDisplayPricing,
} from '../commercial/plans';
import { CentralPrismaService } from '../prisma/central-prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantProvisioningService } from '../provisioning/tenant-provisioning.service';
import { LICENSE_PORTAL_JWT_AUD } from './portal-jwt.types';
import type {
  ActivateLicenseDto,
  AdminPasswordDto,
  PortalLoginDto,
  ProvisionPortalTenantDto,
  RevalidateLicenseDto,
} from './license-portal.dto';

type TenantRow = Tenant & {
  planLabel: string;
  entryFeeBrl: number;
  monthlyFeeBrl: number;
};

@Injectable()
export class LicensePortalService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly central: CentralPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly provisioning: TenantProvisioningService,
  ) {}

  async login(dto: PortalLoginDto) {
    const expectedUser = this.config.get<string>('LICENSE_PORTAL_USER')?.trim();
    if (!expectedUser) {
      throw new UnauthorizedException('Portal de licenças não configurado (LICENSE_PORTAL_USER)');
    }
    if (dto.username.trim() !== expectedUser) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const ok = await this.verifyPortalPassword(dto.password);
    if (!ok) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    const accessToken = await this.jwt.signAsync(
      {
        sub: expectedUser,
        aud: LICENSE_PORTAL_JWT_AUD,
        username: expectedUser,
      },
      { expiresIn: '4h' },
    );
    return { accessToken, expiresIn: 4 * 3600 };
  }

  listPlans() {
    const trial = {
      code: 'trial' as const,
      label: 'Trial',
      entryFeeBrl: 0,
      monthlyFeeBrl: 0,
    };
    const paid = (Object.keys(COMMERCIAL_PLANS) as Array<keyof typeof COMMERCIAL_PLANS>).map(
      (code) => ({
        code,
        label: COMMERCIAL_PLANS[code].label,
        entryFeeBrl: COMMERCIAL_PLANS[code].pricing.entryFeeBrl,
        monthlyFeeBrl: COMMERCIAL_PLANS[code].pricing.monthlyFeeBrl,
      }),
    );
    return [trial, ...paid];
  }

  async listTenants() {
    const rows = await this.central.tenant.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const items = rows.map((t) => this.enrichTenant(t));
    const totals = this.computeTotals(items);
    return { items, totals };
  }

  async provisionTenant(dto: ProvisionPortalTenantDto) {
    const tenant = await this.provisioning.provisionNewTenant({
      slug: dto.slug.trim(),
      cnpj: dto.cnpj.trim(),
      companyName: dto.companyName.trim(),
      databaseName: dto.databaseName.trim(),
      seed: {
        adminEmail: dto.adminEmail.trim(),
        adminPassword: dto.adminPassword,
        adminName: dto.adminName?.trim(),
      },
    });

    const licenseUpdate = dto.commercialPlan
      ? buildActivateLicenseUpdate({
          slug: dto.slug,
          plan: dto.commercialPlan,
        })
      : {};
    await this.central.tenant.update({
      where: { id: tenant.id },
      data: {
        ...licenseUpdate,
        provisionAdminEmail: dto.adminEmail.trim().toLowerCase(),
      },
    });

    const fresh = await this.central.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    return this.enrichTenant(fresh);
  }

  async revalidateLicense(slug: string, dto: RevalidateLicenseDto) {
    const tenant = await this.requireVisibleTenant(slug);
    const months = dto.months ?? 1;
    if (!Number.isFinite(months) || months < 1) {
      throw new BadRequestException('months deve ser >= 1');
    }
    const licenseExpiresAt = extendLicenseExpiresAt(tenant, months);
    const row = await this.central.tenant.update({
      where: { slug },
      data: { licenseExpiresAt, licenseStatus: LicenseStatus.active },
    });
    return this.enrichTenant(row);
  }

  async pauseLicense(slug: string) {
    await this.requireVisibleTenant(slug);
    const row = await this.central.tenant.update({
      where: { slug },
      data: { licenseStatus: LicenseStatus.suspended },
    });
    return this.enrichTenant(row);
  }

  async activateLicense(slug: string, dto: ActivateLicenseDto) {
    await this.requireVisibleTenant(slug);
    const entryPaidAt = dto.entryPaidAt ? this.parseDate(dto.entryPaidAt) : undefined;
    const update = buildActivateLicenseUpdate({
      slug,
      plan: dto.plan,
      entryPaidAt,
      contractStartedAt: entryPaidAt,
      billingDay: dto.billingDay,
      status: LicenseStatus.active,
    });
    const row = await this.central.tenant.update({
      where: { slug },
      data: update,
    });
    return this.enrichTenant(row);
  }

  async archiveTenant(slug: string) {
    await this.requireVisibleTenant(slug);
    const row = await this.central.tenant.update({
      where: { slug },
      data: {
        archivedAt: new Date(),
        licenseStatus: LicenseStatus.expired,
      },
    });
    return this.enrichTenant(row);
  }

  async updateAdminPassword(slug: string, dto: AdminPasswordDto) {
    const tenant = await this.requireVisibleTenant(slug);
    const prisma = await this.tenantPrisma.getClient(slug);
    const email = tenant.provisionAdminEmail?.trim().toLowerCase();

    let userId: string | undefined;
    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      userId = byEmail?.id;
    }
    if (!userId) {
      const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
      if (adminRole) {
        const assignment = await prisma.userRoleAssignment.findFirst({
          where: { roleId: adminRole.id },
          include: { user: true },
        });
        userId = assignment?.userId;
      }
    }
    if (!userId) {
      throw new NotFoundException('Usuário administrador não encontrado no tenant');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    return { ok: true, slug };
  }

  private async requireVisibleTenant(slug: string): Promise<Tenant> {
    const tenant = await this.central.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.archivedAt) {
      throw new NotFoundException(`Cliente não encontrado: ${slug}`);
    }
    return tenant;
  }

  private enrichTenant(t: Tenant): TenantRow {
    const plan = t.commercialPlan as CommercialPlanCode;
    const display = planDisplayPricing(plan);
    return {
      ...t,
      planLabel: display.label,
      entryFeeBrl: display.entryFeeBrl,
      monthlyFeeBrl: display.monthlyFeeBrl,
    };
  }

  private computeTotals(items: TenantRow[]) {
    const contributing = items.filter(
      (t) => t.licenseStatus === LicenseStatus.active || t.licenseStatus === LicenseStatus.trial,
    );
    let entryFeeBrl = 0;
    let monthlyFeeBrl = 0;
    for (const t of contributing) {
      entryFeeBrl += t.entryFeeBrl;
      monthlyFeeBrl += t.monthlyFeeBrl;
    }
    return {
      entryFeeBrl,
      monthlyFeeBrl,
      activeClientCount: contributing.length,
    };
  }

  private parseDate(s: string): Date {
    const d = new Date(`${s}T12:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException(`Data inválida: ${s}`);
    }
    return d;
  }

  private async verifyPortalPassword(plain: string): Promise<boolean> {
    const hash = this.config.get<string>('LICENSE_PORTAL_PASSWORD_HASH')?.trim();
    if (hash) {
      return bcrypt.compare(plain, hash);
    }
    const expected = this.config.get<string>('LICENSE_PORTAL_PASSWORD');
    if (!expected) {
      throw new UnauthorizedException(
        'Portal de licenças não configurado (LICENSE_PORTAL_PASSWORD ou LICENSE_PORTAL_PASSWORD_HASH)',
      );
    }
    const a = Buffer.from(plain);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }
}
