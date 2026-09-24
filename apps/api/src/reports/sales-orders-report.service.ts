import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type SalesOrdersReportVariant = 'espelho' | 'periodo' | 'cliente' | 'produtos';

export type SalesOrdersReportQuery = {
  variant: SalesOrdersReportVariant;
  from?: string;
  to?: string;
  controlMin?: number;
  controlMax?: number;
  partnerId?: string;
  productId?: string;
  salesOrderId?: string;
};

function parseDay(raw: string | undefined, mode: 'start' | 'end'): Date | undefined {
  if (!raw?.trim()) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (mode === 'end') d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}

function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

function lineTotal(item: { quantity: Prisma.Decimal; unitPrice: Prisma.Decimal; discount: Prisma.Decimal }) {
  return dec(item.quantity) * dec(item.unitPrice) - dec(item.discount);
}

const orderInclude = {
  partner: { select: { id: true, name: true } },
  items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
} as const;

@Injectable()
export class SalesOrdersReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private buildFilters(query: SalesOrdersReportQuery) {
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');

    const where: Prisma.SalesOrderWhereInput = {};
    if (from || to) {
      where.orderDate = {};
      if (from) (where.orderDate as Prisma.DateTimeFilter).gte = from;
      if (to) (where.orderDate as Prisma.DateTimeFilter).lte = to;
    }
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.productId) {
      where.items = { some: { productId: query.productId } };
    }
    if (query.controlMin != null || query.controlMax != null) {
      where.controlNumber = {};
      if (query.controlMin != null) (where.controlNumber as Prisma.IntFilter).gte = query.controlMin;
      if (query.controlMax != null) (where.controlNumber as Prisma.IntFilter).lte = query.controlMax;
    }

    return { from, to, where };
  }

  private mapOrder(o: {
    id: string;
    controlNumber: number;
    orderDate: Date;
    status: string;
    paymentMethod: string | null;
    totalAmount: Prisma.Decimal;
    partner: { id: string; name: string };
    items: {
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      eggCategory: string | null;
      product: { sku: string; name: string; unit: string } | null;
    }[];
  }) {
    const items = o.items.map((it) => ({
      productSku: it.product?.sku ?? null,
      productName: it.product?.name ?? it.eggCategory ?? 'Item',
      productUnit: it.product?.unit ?? '',
      eggCategory: it.eggCategory,
      quantity: dec(it.quantity),
      unitPrice: dec(it.unitPrice),
      discount: dec(it.discount),
      lineTotal: lineTotal(it),
    }));
    return {
      id: o.id,
      controlNumber: o.controlNumber,
      orderDate: o.orderDate.toISOString().slice(0, 10),
      partnerId: o.partner.id,
      partnerName: o.partner.name,
      status: o.status,
      paymentMethod: o.paymentMethod,
      totalAmount: dec(o.totalAmount),
      items,
    };
  }

  async report(user: JwtPayload, query: SalesOrdersReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const { where } = this.buildFilters(query);

    let partnerLabel: string | null = null;
    if (query.partnerId) {
      const p = await prisma.partner.findUnique({ where: { id: query.partnerId }, select: { name: true } });
      partnerLabel = p?.name ?? null;
    }
    let productLabel: string | null = null;
    if (query.productId) {
      const p = await prisma.product.findUnique({
        where: { id: query.productId },
        select: { sku: true, name: true },
      });
      if (p) productLabel = `${p.sku} — ${p.name}`;
    }

    const filterMeta = {
      controlMin: query.controlMin ?? null,
      controlMax: query.controlMax ?? null,
      partnerId: query.partnerId ?? null,
      partnerLabel,
      productId: query.productId ?? null,
      productLabel,
      salesOrderId: query.salesOrderId ?? null,
    };

    if (query.variant === 'espelho') {
      let espelhoWhere: Prisma.SalesOrderWhereInput;
      if (query.salesOrderId) {
        espelhoWhere = { id: query.salesOrderId };
      } else if (query.controlMin != null && query.controlMax != null && query.controlMin === query.controlMax) {
        espelhoWhere = { controlNumber: query.controlMin };
      } else if (query.controlMin != null && query.controlMax == null) {
        espelhoWhere = { controlNumber: query.controlMin };
      } else {
        throw new BadRequestException(
          'Informe a venda (seleção na lista) ou o número de controle da venda.',
        );
      }

      const order = await prisma.salesOrder.findFirst({
        where: espelhoWhere,
        include: orderInclude,
      });
      if (!order) {
        return {
          variant: query.variant,
          period: { from: query.from ?? null, to: query.to ?? null },
          filters: filterMeta,
          totals: { orderCount: 0, totalAmount: 0, quantity: 0, itemLineCount: 0 },
          espelho: null,
          periodRows: null,
          clientGroups: null,
          productGroups: null,
        };
      }

      const mapped = this.mapOrder(order);
      const quantity = mapped.items.reduce((s, i) => s + i.quantity, 0);
      return {
        variant: query.variant,
        period: { from: query.from ?? null, to: query.to ?? null },
        filters: filterMeta,
        totals: {
          orderCount: 1,
          totalAmount: mapped.totalAmount,
          quantity,
          itemLineCount: mapped.items.length,
        },
        espelho: mapped,
        periodRows: null,
        clientGroups: null,
        productGroups: null,
      };
    }

    const aggWhere: Prisma.SalesOrderWhereInput = {
      ...where,
      status: 'CONFIRMED',
    };

    if (query.variant === 'periodo') {
      const orders = await prisma.salesOrder.findMany({
        where,
        include: orderInclude,
        orderBy: [{ controlNumber: 'asc' }],
      });
      const periodRows = orders.map((o) => {
        const mapped = this.mapOrder(o);
        return {
          controlNumber: mapped.controlNumber,
          orderDate: mapped.orderDate,
          partnerName: mapped.partnerName,
          status: mapped.status,
          paymentMethod: mapped.paymentMethod,
          totalAmount: mapped.totalAmount,
          itemCount: mapped.items.length,
        };
      });
      const totals = periodRows.reduce(
        (acc, r) => {
          acc.orderCount += 1;
          acc.totalAmount += r.totalAmount;
          acc.itemLineCount += r.itemCount;
          return acc;
        },
        { orderCount: 0, totalAmount: 0, quantity: 0, itemLineCount: 0 },
      );
      return {
        variant: query.variant,
        period: { from: query.from ?? null, to: query.to ?? null },
        filters: filterMeta,
        totals,
        espelho: null,
        periodRows,
        clientGroups: null,
        productGroups: null,
      };
    }

    const orders = await prisma.salesOrder.findMany({
      where: aggWhere,
      include: orderInclude,
      orderBy: [{ controlNumber: 'asc' }],
    });

    if (query.variant === 'cliente') {
      const groups = new Map<
        string,
        { partnerId: string; partnerName: string; orderCount: number; quantity: number; totalAmount: number }
      >();
      for (const o of orders) {
        const mapped = this.mapOrder(o);
        const g = groups.get(mapped.partnerId) ?? {
          partnerId: mapped.partnerId,
          partnerName: mapped.partnerName,
          orderCount: 0,
          quantity: 0,
          totalAmount: 0,
        };
        g.orderCount += 1;
        g.totalAmount += mapped.totalAmount;
        for (const it of mapped.items) g.quantity += it.quantity;
        groups.set(mapped.partnerId, g);
      }
      const clientGroups = [...groups.values()].sort((a, b) =>
        a.partnerName.localeCompare(b.partnerName, 'pt-BR'),
      );
      const totals = clientGroups.reduce(
        (acc, g) => {
          acc.orderCount += g.orderCount;
          acc.totalAmount += g.totalAmount;
          acc.quantity += g.quantity;
          return acc;
        },
        { orderCount: 0, totalAmount: 0, quantity: 0, itemLineCount: 0 },
      );
      return {
        variant: query.variant,
        period: { from: query.from ?? null, to: query.to ?? null },
        filters: filterMeta,
        totals,
        espelho: null,
        periodRows: null,
        clientGroups,
        productGroups: null,
      };
    }

    const productMap = new Map<
      string,
      { productKey: string; productLabel: string; quantity: number; totalAmount: number; orderCount: number }
    >();
    for (const o of orders) {
      const seenInOrder = new Set<string>();
      for (const it of o.items) {
        const key = it.productId ?? `egg:${it.eggCategory ?? '?'}`;
        const label = it.product
          ? `${it.product.sku} — ${it.product.name}`
          : it.eggCategory ?? 'Item sem produto';
        const g = productMap.get(key) ?? {
          productKey: key,
          productLabel: label,
          quantity: 0,
          totalAmount: 0,
          orderCount: 0,
        };
        g.quantity += dec(it.quantity);
        g.totalAmount += lineTotal(it);
        if (!seenInOrder.has(key)) {
          g.orderCount += 1;
          seenInOrder.add(key);
        }
        productMap.set(key, g);
      }
    }
    const productGroups = [...productMap.values()].sort((a, b) =>
      a.productLabel.localeCompare(b.productLabel, 'pt-BR'),
    );
    const totals = productGroups.reduce(
      (acc, g) => {
        acc.itemLineCount += 1;
        acc.totalAmount += g.totalAmount;
        acc.quantity += g.quantity;
        return acc;
      },
      { orderCount: orders.length, totalAmount: 0, quantity: 0, itemLineCount: 0 },
    );

    return {
      variant: query.variant,
      period: { from: query.from ?? null, to: query.to ?? null },
      filters: filterMeta,
      totals,
      espelho: null,
      periodRows: null,
      clientGroups: null,
      productGroups,
    };
  }
}
