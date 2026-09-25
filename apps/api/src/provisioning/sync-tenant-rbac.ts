import { PrismaClient } from '../generated/tenant-client';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './permissions.seed';

/** Garante permissões e papéis padrão no banco do tenant (idempotente). */
export async function ensureTenantRbac(prisma: PrismaClient) {
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
    const wanted = new Set<string>(roleDef.permissions);
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
}
