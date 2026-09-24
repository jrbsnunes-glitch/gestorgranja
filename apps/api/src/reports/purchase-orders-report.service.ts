import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type PurchaseOrdersReportVariant = 'pedidos' | 'produtos_por_pedido';

export type PurchaseOrdersReportQuery = {
  variant: PurchaseOrdersReportVariant;
  from?: string;
  to?: string;
  controlMin?: number;
  controlMax?: number;
  partnerId?: string;
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

function selectedQuote(quotes: { selected: boolean; supplierName: string; totalAmount: Prisma.Decimal }[]) {
  return quotes.find((q) => q.selected) ?? quotes[0] ?? null;
}

@Injectable()
export class PurchaseOrdersReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: PurchaseOrdersReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');

    let partnerLabel: string | null = null;
    let supplierNameFilter: string | undefined;
    if (query.partnerId) {
      const p = await prisma.partner.findUnique({
        where: { id: query.partnerId },
        select: { name: true },
      });
      if (p) {
        partnerLabel = p.name;
        supplierNameFilter = p.name;
      }
    }

    const orderedAt: Prisma.DateTimeFilter | undefined =
      from || to
        ? {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          }
        : undefined;

    const where: Prisma.PurchaseRequestWhereInput = {
      order: orderedAt ? { is: { orderedAt } } : { isNot: null },
    };
    if (query.controlMin != null || query.controlMax != null) {
      where.controlNumber = {};
      if (query.controlMin != null) (where.controlNumber as Prisma.IntFilter).gte = query.controlMin;
      if (query.controlMax != null) (where.controlNumber as Prisma.IntFilter).lte = query.controlMax;
    }
    if (supplierNameFilter) {
      where.quotes = { some: { selected: true, supplierName: supplierNameFilter } };
    }

    const includeOrder = {
      order: {
        include: {
          receipt: true,
          items: {
            include: { product: { select: { sku: true, name: true, unit: true } } },
            orderBy: [{ product: { sku: 'asc' } }] as Prisma.PurchaseOrderItemOrderByWithRelationInput[],
          },
        },
      },
      quotes: true,
    } as const;

    const requests = await prisma.purchaseRequest.findMany({
      where,
      include: includeOrder,
      orderBy: [{ controlNumber: 'asc' }],
    });

    const orderRows = requests
      .filter((r) => r.order != null)
      .map((r) => {
        const order = r.order!;
        const quote = selectedQuote(r.quotes);
        const totalAmount = quote ? dec(quote.totalAmount) : 0;
        return {
          controlNumber: r.controlNumber,
          requestCode: r.code,
          description: r.description,
          status: r.status,
          requestedAt: r.requestedAt.toISOString(),
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt.toISOString(),
          supplierName: quote?.supplierName ?? '—',
          totalAmount,
          financeApproved: order.financeApprovedAt != null,
          payablesGenerated: order.payablesGenerated,
          receivedAt: order.receipt?.receivedAt.toISOString() ?? null,
          itemCount: order.items.length,
        };
      });

    const totals = orderRows.reduce(
      (acc, r) => {
        acc.orderCount += 1;
        acc.totalAmount += r.totalAmount;
        acc.itemLineCount += r.itemCount;
        return acc;
      },
      { orderCount: 0, totalAmount: 0, itemLineCount: 0, quantity: 0 },
    );

    if (query.variant === 'pedidos') {
      return {
        variant: query.variant,
        period: { from: query.from ?? null, to: query.to ?? null },
        filters: {
          controlMin: query.controlMin ?? null,
          controlMax: query.controlMax ?? null,
          partnerId: query.partnerId ?? null,
          partnerLabel,
        },
        totals,
        orderRows,
        orders: null,
      };
    }

    const orders = requests
      .filter((r) => r.order != null)
      .map((r) => {
        const order = r.order!;
        const quote = selectedQuote(r.quotes);
        const items = order.items.map((it) => {
          const quantity = dec(it.quantity);
          const unitPrice = dec(it.unitPrice);
          return {
            productSku: it.product.sku,
            productName: it.product.name,
            productUnit: it.product.unit,
            quantity,
            unitPrice,
            lineTotal: quantity * unitPrice,
          };
        });
        for (const it of items) totals.quantity += it.quantity;

        return {
          controlNumber: r.controlNumber,
          requestCode: r.code,
          orderNumber: order.orderNumber,
          orderedAt: order.orderedAt.toISOString(),
          supplierName: quote?.supplierName ?? '—',
          totalAmount: quote ? dec(quote.totalAmount) : 0,
          status: r.status,
          items,
        };
      });

    return {
      variant: query.variant,
      period: { from: query.from ?? null, to: query.to ?? null },
      filters: {
        controlMin: query.controlMin ?? null,
        controlMax: query.controlMax ?? null,
        partnerId: query.partnerId ?? null,
        partnerLabel,
      },
      totals,
      orderRows: null,
      orders,
    };
  }
}
