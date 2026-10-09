import { PrismaClient as CentralClient } from '../src/generated/central-client';
import { PrismaClient as TenantClient } from '../src/generated/tenant-client';

async function main() {
  const central = new CentralClient({ datasources: { db: { url: process.env.CENTRAL_DATABASE_URL! } } });
  const t = await central.tenant.findUnique({ where: { slug: 'demo' } });
  await central.$disconnect();
  const url = process.env.TENANT_DATABASE_URL!.replace(/\/[^/]+$/, `/${t!.databaseName}`);
  const p = new TenantClient({ datasources: { db: { url } } });
  const orders = await p.salesOrder.findMany({
    where: { status: 'CONFIRMED' },
    orderBy: { orderDate: 'desc' },
    take: 10,
    select: { id: true, orderDate: true, totalAmount: true, controlNumber: true },
  });
  console.log(JSON.stringify(orders.map((o) => ({
    controlNumber: o.controlNumber,
    orderDate: o.orderDate.toISOString().slice(0, 10),
    totalAmount: Number(o.totalAmount),
  })), null, 2));
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const dayFrom = new Date(`${dayKey}T00:00:00.000`);
  const dayTo = new Date(`${dayKey}T23:59:59.999`);
  const dayOrders = await p.salesOrder.findMany({
    where: { status: 'CONFIRMED', orderDate: { gte: dayFrom, lte: dayTo } },
  });
  console.log('dayKey', dayKey, 'count', dayOrders.length, 'sum', dayOrders.reduce((s, o) => s + Number(o.totalAmount), 0));
  await p.$disconnect();
}

main();
