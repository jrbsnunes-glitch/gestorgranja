/**
 * Upsert DEFAULT_PERMISSIONS em todos os tenants READY.
 */
import { PrismaClient as CentralClient } from '../src/generated/central-client';
import { PrismaClient as TenantClient } from '../src/generated/tenant-client';
import { ensureTenantRbac } from '../src/provisioning/sync-tenant-rbac';

async function main() {
  const centralUrl = process.env.CENTRAL_DATABASE_URL;
  const template = process.env.TENANT_DATABASE_URL;
  if (!centralUrl || !template) throw new Error('CENTRAL_DATABASE_URL e TENANT_DATABASE_URL obrigatórios');

  const central = new CentralClient({ datasources: { db: { url: centralUrl } } });
  const tenants = await central.tenant.findMany({ select: { databaseName: true } });
  await central.$disconnect();

  for (const t of tenants) {
    const url = template.replace(/\/[^/]+$/, `/${t.databaseName}`);
    const prisma = new TenantClient({ datasources: { db: { url } } });
    await ensureTenantRbac(prisma);
    await prisma.$disconnect();
    console.log('Permissões e papéis OK:', t.databaseName);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
