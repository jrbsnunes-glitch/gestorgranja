import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFileSync } from 'child_process';
import { createRequire } from 'node:module';
import { existsSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';
import { Prisma, TenantProvisioningStatus } from '../generated/central-client';
import { CentralPrismaService } from '../prisma/central-prisma.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { seedTenantMinimal } from './tenant-minimal-seed';

export type ProvisionSeed = {
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
};

@Injectable()
export class TenantProvisioningService {
  private readonly logger = new Logger(TenantProvisioningService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly central: CentralPrismaService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }

  /** Aceita vazio, `gestorgranja_<slug>` ou só o sufixo (ex.: aurora → gestorgranja_aurora). */
  normalizeDatabaseName(slug: string, raw?: string): string {
    const normalizedSlug = this.normalizeSlug(slug).replace(/-/g, '_');
    const trimmed = raw?.trim() ?? '';
    if (!trimmed) {
      return `gestorgranja_${normalizedSlug}`;
    }
    const lower = trimmed.toLowerCase();
    if (/^gestorgranja_[a-z0-9_]+$/.test(lower)) {
      return lower;
    }
    if (/^[a-z0-9_-]+$/.test(lower)) {
      const suffix = lower.replace(/-/g, '_');
      return `gestorgranja_${suffix}`;
    }
    throw new BadRequestException(
      `Nome de banco inválido: ${trimmed}. Deixe em branco ou use gestorgranja_${normalizedSlug}.`,
    );
  }

  /** Remove registro central incompleto e banco tenant (após falha de provisionamento). */
  async abandonIncompleteTenant(slug: string, cnpj?: string) {
    const normalized = this.normalizeSlug(slug);
    const existing = await this.central.tenant.findUnique({ where: { slug: normalized } });
    if (existing) {
      await this.removeIncompleteTenantRow(existing);
      return;
    }

    const cnpjTrim = cnpj?.trim();
    if (cnpjTrim) {
      const byCnpj = await this.central.tenant.findUnique({ where: { cnpj: cnpjTrim } });
      if (byCnpj) {
        await this.removeIncompleteTenantRow(byCnpj);
      }
    }
  }

  private async removeIncompleteTenantRow(existing: {
    slug: string;
    databaseName: string;
    provisioningStatus: TenantProvisioningStatus;
  }) {
    if (existing.provisioningStatus === TenantProvisioningStatus.READY) {
      throw new BadRequestException(`Cliente "${existing.slug}" já está provisionado.`);
    }
    await this.dropTenantDatabaseIfExists(existing.databaseName);
    await this.central.tenant.delete({ where: { slug: existing.slug } });
    this.tenantPrisma.invalidateClient(existing.slug);
    this.logger.warn(`Tenant incompleto removido: ${existing.slug} (${existing.databaseName})`);
  }

  async provisionNewTenant(params: {
    slug: string;
    cnpj: string;
    companyName: string;
    databaseName: string;
    seed: ProvisionSeed;
  }) {
    const slug = this.normalizeSlug(params.slug);
    const cnpj = params.cnpj.trim();
    const databaseName = this.normalizeDatabaseName(slug, params.databaseName);

    await this.abandonIncompleteTenant(slug, cnpj);

    const tenant = await this.createTenantRow({
      slug,
      cnpj,
      companyName: params.companyName.trim(),
      databaseName,
      provisionAdminEmail: params.seed.adminEmail,
    });

    try {
      await this.createDatabase(databaseName);
      await this.runTenantMigrations(databaseName);
      const url = this.buildTenantUrl(databaseName);
      await seedTenantMinimal(url, {
        adminEmail: params.seed.adminEmail,
        adminPassword: params.seed.adminPassword,
        adminName: params.seed.adminName,
        companyName: params.companyName.trim(),
        cnpj,
      });
      await this.central.tenant.update({
        where: { id: tenant.id },
        data: {
          provisioningStatus: TenantProvisioningStatus.READY,
          provisioningError: null,
          provisioningUpdatedAt: new Date(),
        },
      });
      this.tenantPrisma.invalidateClient(slug);
      return tenant;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.central.tenant.update({
        where: { id: tenant.id },
        data: {
          provisioningStatus: TenantProvisioningStatus.FAILED,
          provisioningError: message,
          provisioningUpdatedAt: new Date(),
        },
      });
      throw err;
    }
  }

  private async createTenantRow(data: {
    slug: string;
    cnpj: string;
    companyName: string;
    databaseName: string;
    provisionAdminEmail: string;
  }) {
    try {
      return await this.central.tenant.create({
        data: {
          slug: data.slug,
          cnpj: data.cnpj,
          companyName: data.companyName,
          databaseName: data.databaseName,
          provisionAdminEmail: data.provisionAdminEmail,
          provisioningStatus: TenantProvisioningStatus.PROVISIONING,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        await this.abandonIncompleteTenant(data.slug, data.cnpj);
        try {
          return await this.central.tenant.create({
            data: {
              slug: data.slug,
              cnpj: data.cnpj,
              companyName: data.companyName,
              databaseName: data.databaseName,
              provisionAdminEmail: data.provisionAdminEmail,
              provisioningStatus: TenantProvisioningStatus.PROVISIONING,
            },
          });
        } catch (retryErr) {
          if (
            retryErr instanceof Prisma.PrismaClientKnownRequestError &&
            retryErr.code === 'P2002'
          ) {
            const target = Array.isArray(retryErr.meta?.target)
              ? retryErr.meta.target.join(', ')
              : 'slug/cnpj';
            throw new BadRequestException(
              `Já existe cliente com este ${target}. Se a tentativa anterior falhou, rode bash atgranja.sh e tente de novo.`,
            );
          }
          throw retryErr;
        }
      }
      throw err;
    }
  }

  private buildTenantUrl(databaseName: string): string {
    const template = this.config.get<string>('TENANT_DATABASE_URL');
    if (!template) throw new Error('TENANT_DATABASE_URL não configurada');
    return template.replace(/\/[^/]+$/, `/${databaseName}`);
  }

  private assertSafeDatabaseName(databaseName: string) {
    if (!/^gestorgranja_[a-z0-9_-]+$/i.test(databaseName)) {
      throw new BadRequestException(`Nome de banco inválido: ${databaseName}`);
    }
  }

  private async dropTenantDatabaseIfExists(databaseName: string) {
    this.assertSafeDatabaseName(databaseName);
    const adminUrl =
      this.config.get<string>('TENANT_ADMIN_DATABASE_URL') ??
      this.config.get<string>('TENANT_DATABASE_URL');
    if (!adminUrl) throw new Error('TENANT_ADMIN_DATABASE_URL não configurada');

    const client = new Client({ connectionString: adminUrl.replace(/\/[^/]+$/, '/postgres') });
    await client.connect();
    try {
      await client.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [databaseName],
      );
      await client.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
    } finally {
      await client.end();
    }
  }

  private async createDatabase(databaseName: string) {
    this.assertSafeDatabaseName(databaseName);
    const adminUrl =
      this.config.get<string>('TENANT_ADMIN_DATABASE_URL') ??
      this.config.get<string>('TENANT_DATABASE_URL');
    if (!adminUrl) throw new Error('TENANT_ADMIN_DATABASE_URL não configurada');

    const client = new Client({ connectionString: adminUrl.replace(/\/[^/]+$/, '/postgres') });
    await client.connect();
    try {
      const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);
      if (exists.rowCount === 0) {
        await client.query(`CREATE DATABASE "${databaseName}"`);
      }
    } finally {
      await client.end();
    }
  }

  /** Raiz do pacote @gestor-granja/api (dist/ → apps/api). */
  private apiRoot(): string {
    return join(__dirname, '..', '..');
  }

  private resolvePrismaCli(): string {
    const apiRoot = this.apiRoot();
    const req = createRequire(join(apiRoot, 'package.json'));
    let pkgPath: string;
    try {
      pkgPath = req.resolve('prisma/package.json');
    } catch {
      throw new Error(
        `Pacote prisma não encontrado a partir de ${apiRoot}. Rode pnpm install na raiz do monorepo.`,
      );
    }
    const prismaBin = join(pkgPath, '..', 'build', 'index.js');
    if (!existsSync(prismaBin)) {
      throw new Error(`Prisma CLI não encontrado em ${prismaBin}`);
    }
    return prismaBin;
  }

  private runTenantMigrations(databaseName: string) {
    const apiRoot = this.apiRoot();
    const url = this.buildTenantUrl(databaseName);
    const schema = join(apiRoot, 'prisma/tenant/schema.prisma');
    if (!existsSync(schema)) {
      throw new Error(`Schema tenant não encontrado: ${schema}`);
    }
    const prismaBin = this.resolvePrismaCli();
    this.logger.log(`Migrando tenant ${databaseName} (schema ${schema})`);
    execFileSync(process.execPath, [prismaBin, 'migrate', 'deploy', `--schema=${schema}`], {
      cwd: apiRoot,
      env: { ...process.env, TENANT_DATABASE_URL: url },
      stdio: 'inherit',
    });
  }
}
