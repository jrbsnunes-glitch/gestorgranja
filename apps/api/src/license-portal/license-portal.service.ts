import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID, timingSafeEqual } from 'crypto';
import { LicenseStatus, type Tenant } from '../generated/central-client';
import {
  buildActivateLicenseUpdate,
  extendLicenseExpiresAt,
  toCommercialPlanEnum,
} from '../commercial/license-ops';
import {
  PLAN_CATALOG,
  type CommercialPlanCode,
  planDisplayName,
  unlimitedTenantLimits,
} from '../commercial/plans';
import { CentralPrismaService } from '../prisma/central-prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { ensureTenantRbac } from '../provisioning/sync-tenant-rbac';
import { TenantProvisioningService } from '../provisioning/tenant-provisioning.service';
import { assertValidUsername } from '../users/username.util';
import { LICENSE_PORTAL_JWT_AUD } from './portal-jwt.types';
import type {
  ActivateLicenseDto,
  AdminPasswordDto,
  PortalLoginDto,
  ProvisionPortalTenantDto,
  EditPortalTenantDto,
  RevalidateLicenseDto,
} from './license-portal.dto';

type TenantRow = Tenant & {
  planLabel: string;
  entryFeeBrl: number;
  monthlyFeeBrl: number;
  adminUsername: string | null;
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
    return (Object.keys(PLAN_CATALOG) as CommercialPlanCode[]).map((code) => ({
      code,
      label: PLAN_CATALOG[code].label,
      includesPayroll: PLAN_CATALOG[code].includesPayroll,
      includesTimeClock: PLAN_CATALOG[code].includesTimeClock,
    }));
  }

  async listTenants() {
    const rows = await this.central.tenant.findMany({
      where: { archivedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    const items = await Promise.all(rows.map((t) => this.enrichTenantWithAdmin(t)));
    const totals = this.computeTotals(items);
    return { items, totals };
  }

  async provisionTenant(dto: ProvisionPortalTenantDto) {
    const slug = this.provisioning.normalizeSlug(dto.slug);
    const cnpj = dto.cnpj.trim();
    const databaseName = this.provisioning.normalizeDatabaseName(slug, dto.databaseName);
    await this.provisioning.abandonIncompleteTenant(slug, cnpj);
    const tenant = await this.provisioning.provisionNewTenant({
      slug,
      cnpj,
      companyName: dto.companyName.trim(),
      databaseName,
      seed: {
        adminEmail: dto.adminEmail.trim(),
        adminPassword: dto.adminPassword,
        adminName: dto.adminName?.trim(),
      },
    });

    const licenseUpdate = buildActivateLicenseUpdate({
      slug,
      plan: dto.commercialPlan,
      contractEntryFeeBrl: dto.contractEntryFeeBrl,
      contractMonthlyFeeBrl: dto.contractMonthlyFeeBrl,
    });
    await this.central.tenant.update({
      where: { id: tenant.id },
      data: {
        ...licenseUpdate,
        provisionAdminEmail: dto.adminEmail.trim().toLowerCase(),
      },
    });

    const fresh = await this.central.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    return this.enrichTenantWithAdmin(fresh);
  }

  async updateTenant(slug: string, dto: EditPortalTenantDto) {
    await this.requireVisibleTenant(slug);
    const data: Record<string, unknown> = {};

    if (dto.companyName !== undefined) data.companyName = dto.companyName.trim();
    if (dto.cnpj !== undefined) data.cnpj = dto.cnpj.trim();
    if (dto.provisionAdminEmail !== undefined) {
      data.provisionAdminEmail = dto.provisionAdminEmail.trim().toLowerCase();
    }
    if (dto.billingDay !== undefined) data.billingDay = dto.billingDay;
    if (dto.licenseStatus !== undefined) data.licenseStatus = dto.licenseStatus as LicenseStatus;
    if (dto.licenseExpiresAt !== undefined) {
      data.licenseExpiresAt = dto.licenseExpiresAt
        ? this.parseDate(dto.licenseExpiresAt)
        : null;
    }

    if (dto.commercialPlan !== undefined) {
      data.commercialPlan = toCommercialPlanEnum(dto.commercialPlan);
      const limits = unlimitedTenantLimits();
      data.maxBirds = limits.maxBirds;
      data.maxBarns = limits.maxBarns;
      data.maxUsers = limits.maxUsers;
    }
    if (dto.contractEntryFeeBrl !== undefined) {
      data.contractEntryFeeBrl = dto.contractEntryFeeBrl;
    }
    if (dto.contractMonthlyFeeBrl !== undefined) {
      data.contractMonthlyFeeBrl = dto.contractMonthlyFeeBrl;
    }

    const syncAdmin =
      dto.adminUsername !== undefined || dto.provisionAdminEmail !== undefined;

    if (Object.keys(data).length === 0 && !syncAdmin) {
      throw new BadRequestException('Nenhum campo para atualizar');
    }

    let row: Tenant;
    if (Object.keys(data).length > 0) {
      try {
        row = await this.central.tenant.update({ where: { slug }, data });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('Unique constraint')) {
          throw new BadRequestException('CNPJ já utilizado por outro cliente');
        }
        throw err;
      }
    } else {
      row = await this.requireVisibleTenant(slug);
    }

    if (dto.companyName !== undefined || dto.cnpj !== undefined) {
      await this.syncTenantCompany(slug, {
        companyName: dto.companyName,
        cnpj: dto.cnpj,
      });
    }

    if (syncAdmin) {
      await this.syncTenantAdminUser(slug, {
        adminUsername: dto.adminUsername,
        provisionAdminEmail: dto.provisionAdminEmail ?? row.provisionAdminEmail ?? undefined,
      });
    }

    return this.enrichTenantWithAdmin(row);
  }

  private async syncTenantAdminUser(
    slug: string,
    patch: { adminUsername?: string; provisionAdminEmail?: string },
  ) {
    const central = await this.requireVisibleTenant(slug);
    const emailHint = patch.provisionAdminEmail ?? central.provisionAdminEmail ?? '';
    const usernameHint = patch.adminUsername ?? '';

    let username: string | undefined;
    if (usernameHint.trim()) {
      try {
        username = assertValidUsername(usernameHint);
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : 'Usuário inválido');
      }
    }

    const email = emailHint.trim().toLowerCase();
    if (!username || !email) {
      throw new BadRequestException('Informe usuário e e-mail admin para configurar o login da granja.');
    }

    let admin = await this.resolveTenantAdminUser(slug, { email, username });
    const prisma = await this.tenantPrisma.getClient(slug);

    if (!admin) {
      const adminRole = await this.requireAdminRole(prisma);
      admin = await prisma.user.create({
        data: {
          username,
          email,
          name: central.companyName,
          passwordHash: await bcrypt.hash(randomUUID(), 10),
          roleAssignments: { create: { roleId: adminRole.id } },
        },
      });
    } else {
      await this.ensureUserHasAdminRole(prisma, admin.id);
    }

    if (username !== admin.username) {
      const taken = await prisma.user.findFirst({
        where: { username, NOT: { id: admin.id } },
      });
      if (taken) throw new BadRequestException('Usuário de login já em uso nesta granja');
    }

    if (email !== admin.email) {
      const taken = await prisma.user.findFirst({
        where: { email, NOT: { id: admin.id } },
      });
      if (taken) throw new BadRequestException('E-mail já em uso nesta granja');
    }

    if (username !== admin.username || email !== admin.email) {
      await prisma.user.update({
        where: { id: admin.id },
        data: { username, email },
      });
    }
  }

  private async syncTenantCompany(
    slug: string,
    patch: { companyName?: string; cnpj?: string },
  ) {
    try {
      const prisma = await this.tenantPrisma.getClient(slug);
      const company = await prisma.company.findFirst();
      if (!company) return;
      await prisma.company.update({
        where: { id: company.id },
        data: {
          ...(patch.companyName !== undefined
            ? { legalName: patch.companyName, tradeName: patch.companyName }
            : {}),
          ...(patch.cnpj !== undefined ? { cnpj: patch.cnpj } : {}),
        },
      });
    } catch {
      // tenant DB indisponível — registro central já foi salvo
    }
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
    return this.enrichTenantWithAdmin(row);
  }

  async pauseLicense(slug: string) {
    await this.requireVisibleTenant(slug);
    const row = await this.central.tenant.update({
      where: { slug },
      data: { licenseStatus: LicenseStatus.suspended },
    });
    return this.enrichTenantWithAdmin(row);
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
      contractEntryFeeBrl: dto.contractEntryFeeBrl,
      contractMonthlyFeeBrl: dto.contractMonthlyFeeBrl,
    });
    const row = await this.central.tenant.update({
      where: { slug },
      data: update,
    });
    return this.enrichTenantWithAdmin(row);
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
    return this.enrichTenantWithAdmin(row);
  }

  async updateAdminPassword(slug: string, dto: AdminPasswordDto) {
    const tenant = await this.requireVisibleTenant(slug);
    const admin = await this.resolveTenantAdminUser(slug, {
      email: tenant.provisionAdminEmail,
      username: null,
    });
    if (!admin) {
      throw new BadRequestException(
        'Nenhum usuário admin na granja. Em Editar, preencha usuário e e-mail admin e salve; depois use Senha admin.',
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    const prisma = await this.tenantPrisma.getClient(slug);
    await prisma.user.update({
      where: { id: admin.id },
      data: { passwordHash },
    });
    return { ok: true, slug, username: admin.username };
  }

  private async requireVisibleTenant(slug: string): Promise<Tenant> {
    const tenant = await this.central.tenant.findUnique({ where: { slug } });
    if (!tenant || tenant.archivedAt) {
      throw new NotFoundException(`Cliente não encontrado: ${slug}`);
    }
    return tenant;
  }

  private async enrichTenantWithAdmin(t: Tenant): Promise<TenantRow> {
    const admin = await this.findTenantAdminUser(t.slug, t.provisionAdminEmail).catch(() => null);
    return {
      ...this.enrichTenant(t),
      adminUsername: admin?.username ?? null,
    };
  }

  private enrichTenant(t: Tenant): Omit<TenantRow, 'adminUsername'> {
    return {
      ...t,
      planLabel: planDisplayName(t.commercialPlan),
      entryFeeBrl: t.contractEntryFeeBrl,
      monthlyFeeBrl: t.contractMonthlyFeeBrl,
    };
  }

  private async findTenantAdminUser(slug: string, provisionAdminEmail: string | null) {
    return this.resolveTenantAdminUser(slug, {
      email: provisionAdminEmail,
      username: null,
    });
  }

  private async resolveTenantAdminUser(
    slug: string,
    hints: { email?: string | null; username?: string | null },
  ) {
    const prisma = await this.tenantPrisma.getClient(slug);
    const email = hints.email?.trim().toLowerCase();
    if (email) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) return byEmail;
    }

    if (hints.username?.trim()) {
      try {
        const username = assertValidUsername(hints.username);
        const byUsername = await prisma.user.findUnique({ where: { username } });
        if (byUsername) return byUsername;
      } catch {
        /* ignore invalid hint */
      }
    }

    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    if (adminRole) {
      const assignment = await prisma.userRoleAssignment.findFirst({
        where: { roleId: adminRole.id },
        include: { user: true },
      });
      if (assignment?.user) return assignment.user;
    }

    return prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
  }

  private async requireAdminRole(prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>) {
    let adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    if (!adminRole) {
      await ensureTenantRbac(prisma);
      adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    }
    if (!adminRole) {
      throw new BadRequestException('Não foi possível criar o perfil admin nesta granja.');
    }
    return adminRole;
  }

  private async ensureUserHasAdminRole(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    userId: string,
  ) {
    const adminRole = await this.requireAdminRole(prisma);
    const link = await prisma.userRoleAssignment.findFirst({
      where: { userId, roleId: adminRole.id },
    });
    if (!link) {
      await prisma.userRoleAssignment.create({
        data: { userId, roleId: adminRole.id },
      });
    }
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
