/**
 * Importa plano de contas padrão (granja) em todos os tenants vazios.
 * Uso: tsx scripts/seed-chart-accounts-all-tenants.ts
 * Forçar recarga: CHART_ACCOUNTS_FORCE=1 tsx scripts/seed-chart-accounts-all-tenants.ts
 */
import { PrismaClient as CentralPrisma } from '../src/generated/central-client';
import { PrismaClient as TenantPrisma } from '../src/generated/tenant-client';
import { ensureChartAccountsSeeded } from '../src/provisioning/seed-chart-accounts';

function buildUrl(template: string, databaseName: string): string {
  return template.replace(/\/[^/]+$/, `/${databaseName}`);
}

async function main() {
  const centralUrl = process.env.CENTRAL_DATABASE_URL;
  const template = process.env.TENANT_DATABASE_URL;
  if (!centralUrl || !template) {
    throw new Error('CENTRAL_DATABASE_URL e TENANT_DATABASE_URL são obrigatórios');
  }
  const force = process.env.CHART_ACCOUNTS_FORCE === '1';

  const central = new CentralPrisma({ datasources: { db: { url: centralUrl } } });
  const tenants = await central.tenant.findMany({ select: { databaseName: true, slug: true } });
  await central.$disconnect();

  for (const t of tenants) {
    const url = buildUrl(template, t.databaseName);
    const prisma = new TenantPrisma({ datasources: { db: { url } } });
    try {
      const before = await prisma.chartAccount.count();
      const n = await ensureChartAccountsSeeded(prisma, { forceReplace: force });
      const after = await prisma.chartAccount.count();
      console.log(`${t.slug}: ${before} → ${after} contas (seed ${n})`);
    } finally {
      await prisma.$disconnect();
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
