/**
 * Upsert DEFAULT_PERMISSIONS em todos os tenants READY.
 */
import { PrismaClient as CentralClient } from '../src/generated/central-client';
import { PrismaClient as TenantClient } from '../src/generated/tenant-client';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from '../src/provisioning/permissions.seed';

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
    for (const p of DEFAULT_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: p.code },
        create: p,
        update: { module: p.module, action: p.action },
      });
    }

    const permissionRows = await prisma.permission.findMany();
    const permByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

    for (const roleDef of DEFAULT_ROLES) {
      const role = await prisma.role.upsert({
        where: { name: roleDef.name },
        create: { name: roleDef.name },
        update: {},
      });
      const wanted = new Set(roleDef.permissions);
      const existing = await prisma.rolePermission.findMany({
        where: { roleId: role.id },
        include: { permission: true },
      });
      for (const rp of existing) {
        if (!wanted.has(rp.permission.code)) {
          await prisma.rolePermission.delete({
            where: { roleId_permissionId: { roleId: role.id, permissionId: rp.permissionId } },
          });
        }
      }
      for (const code of roleDef.permissions) {
        const permissionId = permByCode.get(code);
        if (!permissionId) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: role.id, permissionId } },
          create: { roleId: role.id, permissionId },
          update: {},
        });
      }
    }

    await prisma.$disconnect();
    console.log('Permissões e papéis OK:', t.databaseName);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
