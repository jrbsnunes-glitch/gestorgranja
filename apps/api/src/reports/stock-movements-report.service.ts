import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma, StockMovementType } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

export type StockMovementsReportQuery = {
  from?: string;
  to?: string;
  controlMin?: number;
  controlMax?: number;
  chartAccountId?: string;
  includeIn?: boolean;
  includeOut?: boolean;
  includeAdjust?: boolean;
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

@Injectable()
export class StockMovementsReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, query: StockMovementsReportQuery) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = parseDay(query.from, 'start');
    const to = parseDay(query.to, 'end');

    const includeIn = query.includeIn !== false;
    const includeOut = query.includeOut !== false;
    const includeAdjust = query.includeAdjust !== false;

    const types: StockMovementType[] = [];
    if (includeIn) types.push(StockMovementType.IN);
    if (includeOut) types.push(StockMovementType.OUT);
    if (includeAdjust) types.push(StockMovementType.ADJUST);

    if (types.length === 0) {
      return {
        period: { from: query.from ?? null, to: query.to ?? null },
        filters: {
          controlMin: query.controlMin ?? null,
          controlMax: query.controlMax ?? null,
          chartAccountId: query.chartAccountId ?? null,
          chartAccountLabel: null,
          includeIn,
          includeOut,
          includeAdjust,
        },
        totals: {
          rowCount: 0,
          quantityIn: 0,
          quantityOut: 0,
          quantityAdjust: 0,
          stockValue: 0,
        },
        rows: [],
      };
    }

    const where: Prisma.StockMovementWhereInput = {};
    if (from || to) {
      where.movedAt = {};
      if (from) (where.movedAt as Prisma.DateTimeFilter).gte = from;
      if (to) (where.movedAt as Prisma.DateTimeFilter).lte = to;
    }
    if (query.chartAccountId) where.chartAccountId = query.chartAccountId;
    if (query.controlMin != null || query.controlMax != null) {
      where.controlNumber = {};
      if (query.controlMin != null) (where.controlNumber as Prisma.IntFilter).gte = query.controlMin;
      if (query.controlMax != null) (where.controlNumber as Prisma.IntFilter).lte = query.controlMax;
    }
    if (types.length > 0 && types.length < 3) {
      where.type = { in: types };
    }

    let chartAccountLabel: string | null = null;
    if (query.chartAccountId) {
      const acc = await prisma.chartAccount.findUnique({
        where: { id: query.chartAccountId },
        select: { code: true, name: true },
      });
      if (acc) chartAccountLabel = `${acc.code} — ${acc.name}`;
    }

    const rows = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { sku: true, name: true, unit: true } },
        chartAccount: { select: { code: true, name: true } },
        stockLocation: { select: { code: true, name: true } },
      },
      orderBy: [{ controlNumber: 'asc' }],
    });

    let totalIn = 0;
    let totalOut = 0;
    let totalAdjust = 0;
    let totalValue = 0;

    const mapped = rows.map((r) => {
      const qty = dec(r.quantity);
      if (r.type === StockMovementType.IN) totalIn += qty;
      else if (r.type === StockMovementType.OUT) totalOut += qty;
      else totalAdjust += qty;
      const unitCost = r.unitCost != null ? dec(r.unitCost) : null;
      if (unitCost != null) totalValue += qty * unitCost;

      return {
        controlNumber: r.controlNumber,
        movedAt: r.movedAt.toISOString(),
        type: r.type,
        quantity: qty,
        unitCost,
        reference: r.reference,
        productSku: r.product.sku,
        productName: r.product.name,
        productUnit: r.product.unit,
        chartAccount: `${r.chartAccount.code} — ${r.chartAccount.name}`,
        stockLocation: r.stockLocation
          ? `${r.stockLocation.code} — ${r.stockLocation.name}`
          : null,
      };
    });

    return {
      period: { from: query.from ?? null, to: query.to ?? null },
      filters: {
        controlMin: query.controlMin ?? null,
        controlMax: query.controlMax ?? null,
        chartAccountId: query.chartAccountId ?? null,
        chartAccountLabel,
        includeIn,
        includeOut,
        includeAdjust,
      },
      totals: {
        rowCount: mapped.length,
        quantityIn: totalIn,
        quantityOut: totalOut,
        quantityAdjust: totalAdjust,
        stockValue: totalValue,
      },
      rows: mapped,
    };
  }
}
