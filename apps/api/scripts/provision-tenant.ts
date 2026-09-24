import { LicenseStatus, PrismaClient, TenantProvisioningStatus } from '../src/generated/central-client';

async function main() {
  const [slug, cnpj, companyName, databaseName] = process.argv.slice(2);
  if (!slug || !cnpj || !companyName || !databaseName) {
    throw new Error('Uso: provision-tenant.ts <slug> <cnpj> <companyName> <databaseName>');
  }
  const url = process.env.CENTRAL_DATABASE_URL;
  if (!url) throw new Error('CENTRAL_DATABASE_URL é obrigatório');

  const central = new PrismaClient({ datasources: { db: { url } } });
  const row = await central.tenant.upsert({
    where: { slug },
    create: {
      slug,
      cnpj,
      companyName,
      databaseName,
      licenseStatus: LicenseStatus.trial,
      provisioningStatus: TenantProvisioningStatus.PENDING,
    },
    update: { companyName, databaseName },
  });
  await central.$disconnect();
  console.log('Tenant registrado no central:', row);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
