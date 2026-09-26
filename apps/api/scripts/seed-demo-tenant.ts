/**
 * Provisiona tenant demo completo (central + DB + migrate + seed).
 * Uso: tsx scripts/seed-demo-tenant.ts
 */
import { TenantProvisioningService } from '../src/provisioning/tenant-provisioning.service';
import { CentralPrismaService } from '../src/prisma/central-prisma.service';
import { TenantPrismaService } from '../src/prisma/tenant-prisma.service';
import { ConfigService } from '@nestjs/config';
async function main() {
  const config = new ConfigService(process.env as Record<string, string>);
  const central = new CentralPrismaService();
  await central.$connect();
  const tenantPrisma = new TenantPrismaService(central, config);
  const provisioning = new TenantProvisioningService(config, central, tenantPrisma);

  const existing = await central.tenant.findUnique({ where: { slug: 'demo' } });
  if (existing?.provisioningStatus === 'READY') {
    if (existing.commercialPlan !== 'complete') {
      await central.tenant.update({
        where: { slug: 'demo' },
        data: { commercialPlan: 'complete' },
      });
      console.log('Tenant demo já provisionado — plano ajustado para Completo');
    } else {
      console.log('Tenant demo já provisionado');
    }
    await central.$disconnect();
    return;
  }
  if (existing) {
    await central.tenant.delete({ where: { slug: 'demo' } }).catch(() => undefined);
  }

  await provisioning.provisionNewTenant({
    slug: 'demo',
    cnpj: '00000000000191',
    companyName: 'Granja Demo',
    databaseName: 'gestorgranja_demo',
    seed: {
      adminEmail: 'admin@demo.local',
      adminPassword: 'admin123',
      adminName: 'Admin Demo',
    },
  });

  await central.tenant.update({
    where: { slug: 'demo' },
    data: { commercialPlan: 'complete' },
  });

  console.log('Tenant demo OK — login: slug demo / usuário admin / senha admin123 (plano Completo)');
  await central.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
