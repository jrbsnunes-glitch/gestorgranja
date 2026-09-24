import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type StockReceiptsReportVariant = 'notas' | 'produtos_por_nota';

export type StockReceiptsReportQuery = {
  variant: StockReceiptsReportVariant;
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

function mapReceiptHeader(r: {
  controlNumber: number;
  receivedAt: Date;
  invoiceNumber: string | null;
  invoiceSeries: string | null;
  issuedAt: Date | null;
  nfeAccessKey: string | null;
  mode: string;
  totalAmount: Prisma.Decimal;
  notes: string | null;
  partner: { name: string };
  stockLocation: { code: string; name: string } | null;
  chartAccount: { code: string; name: string } | null;
}) {
  return {
    controlNumber: r.controlNumber,
    receivedAt: r.receivedAt.toISOString(),
    partnerName: r.partner.name,
    invoiceNumber: r.invoiceNumber,
    invoiceSeries: r.invoiceSeries,
    issuedAt: r.issuedAt?.toISOString().slice(0, 10) ?? null,
    nfeAccessKey: r.nfeAccessKey,
    mode: r.mode,
    totalAmount: dec(r.totalAmount),
    notes: r.notes,
    stockLocation: r.stockLocation ? `${r.stockLocation.code} — ${r.stockLocation.name}` : null,
    chartAccount: r.chartAccount ? `${r.chartAccount.code} — ${r.chartAccount.name}` : null,
  };
}

@Injectable()
export class StockReceiptsReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: StockReceiptsReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');

    const where: Prisma.StockReceiptWhereInput = {};
    if (from || to) {
      where.receivedAt = {};
      if (from) (where.receivedAt as Prisma.DateTimeFilter).gte = from;
      if (to) (where.receivedAt as Prisma.DateTimeFilter).lte = to;
    }
    if (query.partnerId) where.partnerId = query.partnerId;
    if (query.controlMin != null || query.controlMax != null) {
      where.controlNumber = {};
      if (query.controlMin != null) (where.controlNumber as Prisma.IntFilter).gte = query.controlMin;
      if (query.controlMax != null) (where.controlNumber as Prisma.IntFilter).lte = query.controlMax;
    }

    let partnerLabel: string | null = null;
    if (query.partnerId) {
      const p = await prisma.partner.findUnique({
        where: { id: query.partnerId },
        select: { name: true },
      });
      partnerLabel = p?.name ?? null;
    }

    const includeBase = {
      partner: { select: { name: true } },
      stockLocation: { select: { code: true, name: true } },
      chartAccount: { select: { code: true, name: true } },
    } as const;

    if (query.variant === 'notas') {
      const rows = await prisma.stockReceipt.findMany({
        where,
        include: {
          ...includeBase,
          _count: { select: { items: true } },
        },
        orderBy: [{ controlNumber: 'asc' }],
      });

      const mapped = rows.map((r) => ({
        ...mapReceiptHeader(r),
        itemCount: r._count.items,
      }));

      const totalAmount = mapped.reduce((s, r) => s + r.totalAmount, 0);

      return {
        variant: query.variant,
        period: { from: query.from ?? null, to: query.to ?? null },
        filters: {
          controlMin: query.controlMin ?? null,
          controlMax: query.controlMax ?? null,
          partnerId: query.partnerId ?? null,
          partnerLabel,
        },
        totals: {
          receiptCount: mapped.length,
          totalAmount,
          itemLineCount: mapped.reduce((s, r) => s + r.itemCount, 0),
        },
        noteRows: mapped,
        receipts: null,
      };
    }

    const receipts = await prisma.stockReceipt.findMany({
      where,
      include: {
        ...includeBase,
        items: {
          include: {
            product: { select: { sku: true, name: true, unit: true } },
          },
          orderBy: [{ product: { sku: 'asc' } }],
        },
      },
      orderBy: [{ controlNumber: 'asc' }],
    });

    const mappedReceipts = receipts.map((r) => {
      const items = r.items.map((it) => {
        const quantity = dec(it.quantity);
        const unitCost = dec(it.unitCost);
        return {
          productSku: it.product.sku,
          productName: it.product.name,
          productUnit: it.product.unit,
          quantity,
          unitCost,
          lineTotal: quantity * unitCost,
          batchCode: it.batchCode,
          expiresAt: it.expiresAt?.toISOString().slice(0, 10) ?? null,
        };
      });
      return {
        ...mapReceiptHeader(r),
        items,
      };
    });

    const totals = mappedReceipts.reduce(
      (acc, r) => {
        acc.receiptCount += 1;
        acc.totalAmount += r.totalAmount;
        acc.itemLineCount += r.items.length;
        for (const it of r.items) acc.quantity += it.quantity;
        return acc;
      },
      { receiptCount: 0, totalAmount: 0, itemLineCount: 0, quantity: 0 },
    );

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
      noteRows: null,
      receipts: mappedReceipts,
    };
  }
}
