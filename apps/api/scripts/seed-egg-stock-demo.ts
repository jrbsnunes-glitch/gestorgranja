/**
 * Produtos OVO-* e EggStockConfig no tenant demo (DB já existente).
 * Uso: dotenv -e ../../.env -- tsx scripts/seed-egg-stock-demo.ts
 */
import { PrismaClient as CentralClient } from '../src/generated/central-client';
import { PrismaClient as TenantClient } from '../src/generated/tenant-client';
import { seedEggStockIntegration } from '../src/provisioning/tenant-minimal-seed';

async function main() {
  const centralUrl = process.env.CENTRAL_DATABASE_URL;
  const template = process.env.TENANT_DATABASE_URL;
  if (!centralUrl || !template) {
    throw new Error('CENTRAL_DATABASE_URL e TENANT_DATABASE_URL são obrigatórios');
  }

  const central = new CentralClient({ datasources: { db: { url: centralUrl } } });
  const tenant = await central.tenant.findUnique({ where: { slug: 'demo' } });
  await central.$disconnect();
  if (!tenant) {
    throw new Error('Tenant demo não encontrado');
  }

  const tenantUrl = template.replace(/\/[^/]+$/, `/${tenant.databaseName}`);
  const prisma = new TenantClient({ datasources: { db: { url: tenantUrl } } });
  try {
    await seedEggStockIntegration(prisma);
    console.log('Egg stock seed OK em', tenant.databaseName);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
