import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../generated/tenant-client';
import { assertValidUsername, usernameFromEmail } from '../users/username.util';
import { DEFAULT_PERMISSIONS, DEFAULT_ROLES } from './permissions.seed';
import { ensureChartAccountsSeeded } from './seed-chart-accounts';

export async function seedEggStockIntegration(prisma: PrismaClient) {
  const stockAccount =
    (await prisma.chartAccount.findFirst({ where: { code: '1.1.3.03', isActive: true } })) ??
    (await prisma.chartAccount.findFirst({ where: { code: '1.1.3.04', isActive: true } }));
  if (!stockAccount) throw new Error('Plano de contas não encontrado para integração de ovos');
  const carton = await prisma.product.upsert({
    where: { sku: 'OVO-CARTELA-30' },
    create: {
      sku: 'OVO-CARTELA-30',
      name: 'Cartela de ovos (30 un)',
      type: 'PACKAGED_EGG',
      unit: 'UN',
    },
    update: { name: 'Cartela de ovos (30 un)', type: 'PACKAGED_EGG' },
  });
  const box = await prisma.product.upsert({
    where: { sku: 'OVO-CAIXA-360' },
    create: {
      sku: 'OVO-CAIXA-360',
      name: 'Caixa de ovos (12 cartelas)',
      type: 'PACKAGED_EGG',
      unit: 'UN',
    },
    update: { name: 'Caixa de ovos (12 cartelas)', type: 'PACKAGED_EGG' },
  });

  await prisma.eggStockConfig.upsert({
    where: { id: 'default' },
    create: {
      id: 'default',
      enabled: true,
      eggsPerCarton: 30,
      cartonsPerBox: 12,
      syncCartons: true,
      syncBoxes: true,
      cartonProductId: carton.id,
      boxProductId: box.id,
      chartAccountId: stockAccount.id,
    },
    update: {
      enabled: true,
      cartonProductId: carton.id,
      boxProductId: box.id,
      chartAccountId: stockAccount.id,
    },
  });
}

export type TenantMinimalSeedOptions = {
  adminEmail: string;
  adminPassword: string;
  adminName?: string;
  adminUsername?: string;
  companyName: string;
  cnpj: string;
};

export async function seedTenantMinimal(tenantUrl: string, opts: TenantMinimalSeedOptions) {
  const prisma = new PrismaClient({ datasources: { db: { url: tenantUrl } } });
  try {
    for (const p of DEFAULT_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: p.code },
        create: p,
        update: { module: p.module, action: p.action },
      });
    }

    const permissionRows = await prisma.permission.findMany();
    const permByCode = new Map(permissionRows.map((p) => [p.code, p.id]));

    for (const role of DEFAULT_ROLES) {
      const row = await prisma.role.upsert({
        where: { name: role.name },
        create: { name: role.name },
        update: {},
      });
      for (const code of role.permissions) {
        const permissionId = permByCode.get(code);
        if (!permissionId) continue;
        await prisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId: row.id, permissionId } },
          create: { roleId: row.id, permissionId },
          update: {},
        });
      }
    }

    const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
    const hash = await bcrypt.hash(opts.adminPassword, 10);
    const email = opts.adminEmail.trim().toLowerCase();
    const username = opts.adminUsername?.trim()
      ? assertValidUsername(opts.adminUsername)
      : usernameFromEmail(email);

    const user = await prisma.user.upsert({
      where: { username },
      create: {
        username,
        email,
        name: opts.adminName ?? 'Administrador',
        passwordHash: hash,
        roleAssignments: { create: { roleId: adminRole.id } },
      },
      update: {
        email,
        passwordHash: hash,
        name: opts.adminName ?? 'Administrador',
      },
    });

    await prisma.userRoleAssignment.deleteMany({ where: { userId: user.id } });
    await prisma.userRoleAssignment.create({ data: { userId: user.id, roleId: adminRole.id } });

    await prisma.company.upsert({
      where: { cnpj: opts.cnpj },
      create: {
        cnpj: opts.cnpj,
        legalName: opts.companyName,
        tradeName: opts.companyName,
      },
      update: { legalName: opts.companyName, tradeName: opts.companyName },
    });

    await ensureChartAccountsSeeded(prisma);

    const hyLine = await prisma.breedLineage.upsert({
      where: { code: 'HY-LINE-W36' },
      create: { code: 'HY-LINE-W36', name: 'Hy-Line W-36' },
      update: {},
    });

    for (const point of [
      { ageDays: 140, layRatePct: 85, avgEggWeightG: 58 },
      { ageDays: 180, layRatePct: 92, avgEggWeightG: 60 },
      { ageDays: 220, layRatePct: 94, avgEggWeightG: 62 },
      { ageDays: 300, layRatePct: 90, avgEggWeightG: 63 },
    ]) {
      await prisma.breedStandardPoint.upsert({
        where: { breedLineageId_ageDays: { breedLineageId: hyLine.id, ageDays: point.ageDays } },
        create: { breedLineageId: hyLine.id, ...point },
        update: { layRatePct: point.layRatePct, avgEggWeightG: point.avgEggWeightG },
      });
    }

    const barn = await prisma.barn.upsert({
      where: { code: 'G1' },
      create: { code: 'G1', name: 'Galpão 1', capacity: 12000 },
      update: {},
    });

    await prisma.flockLot.upsert({
      where: { code: 'L2025-01' },
      create: {
        code: 'L2025-01',
        barnId: barn.id,
        breedLineageId: hyLine.id,
        housingDate: new Date('2025-01-15'),
        housedQty: 10000,
      },
      update: {},
    });

    await seedEggStockIntegration(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
