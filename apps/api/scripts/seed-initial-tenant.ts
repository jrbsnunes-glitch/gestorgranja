/**
 * Provisiona o primeiro tenant a partir de variáveis de ambiente (.env).
 */
import { TenantProvisioningService } from '../src/provisioning/tenant-provisioning.service';
import { CentralPrismaService } from '../src/prisma/central-prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import { ConfigService } from '@nestjs/config';

function required(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`${name} é obrigatório no .env`);
  return v;
}

async function main() {
  const slug = required('INITIAL_TENANT_SLUG');
  const cnpj = required('INITIAL_TENANT_CNPJ');
  const companyName = required('INITIAL_COMPANY_NAME');
  const adminEmail = required('INITIAL_ADMIN_EMAIL');
  const adminPassword = required('INITIAL_ADMIN_PASSWORD');
  const databaseName = process.env.INITIAL_TENANT_DATABASE?.trim() || `gestorgranja_${slug.replace(/-/g, '_')}`;

  const config = new ConfigService(process.env as Record<string, string>);
  const central = new CentralPrismaService();
  await central.$connect();
  const tenantPrisma = new TenantPrismaService(central, config);
  const provisioning = new TenantProvisioningService(config, central, tenantPrisma);

  const existing = await central.tenant.findUnique({ where: { slug } });
  if (existing?.provisioningStatus === 'READY') {
    console.log(`Tenant "${slug}" já provisionado.`);
    await central.$disconnect();
    return;
  }
  if (existing) {
    await central.tenant.delete({ where: { slug } }).catch(() => undefined);
  }

  await provisioning.provisionNewTenant({
    slug,
    cnpj,
    companyName,
    databaseName,
    seed: {
      adminEmail,
      adminPassword,
      adminName: process.env.INITIAL_ADMIN_NAME?.trim() || 'Administrador',
    },
  });

  console.log(`Tenant "${slug}" OK — login: slug ${slug} / ${adminEmail}`);
  await central.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
