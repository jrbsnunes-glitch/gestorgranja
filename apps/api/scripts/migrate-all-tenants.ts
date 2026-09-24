import { execFileSync } from 'child_process';
import { join } from 'path';
import { PrismaClient } from '../src/generated/central-client';

async function main() {
  const centralUrl = process.env.CENTRAL_DATABASE_URL;
  const template = process.env.TENANT_DATABASE_URL;
  if (!centralUrl || !template) {
    throw new Error('CENTRAL_DATABASE_URL e TENANT_DATABASE_URL são obrigatórios');
  }

  const central = new PrismaClient({ datasources: { db: { url: centralUrl } } });
  const tenants = await central.tenant.findMany({ select: { databaseName: true } });
  await central.$disconnect();

  const schema = join(process.cwd(), 'prisma/tenant/schema.prisma');
  for (const t of tenants) {
    const url = template.replace(/\/[^/]+$/, `/${t.databaseName}`);
    console.log('Migrando', t.databaseName);
    execFileSync('npx', ['prisma', 'migrate', 'deploy', `--schema=${schema}`], {
      env: { ...process.env, TENANT_DATABASE_URL: url },
      stdio: 'inherit',
      shell: true,
    });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
