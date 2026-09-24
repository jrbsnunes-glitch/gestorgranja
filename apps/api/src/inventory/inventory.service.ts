import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma, ProductType, StockMovementType } from '../generated/tenant-client';
import { defaultStockChartAccountId } from '../finance/chart-account-defaults';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductGroupDto } from './dto/create-product-group.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StockMovementDto } from './dto/stock-movement.dto';
import { averageCostByProduct } from './product-cost.util';

function dec(v: { toString(): string } | number | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

function slugCode(name: string) {
  const base = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24);
  return base || 'GRUPO';
}

function mapProductRow(
  p: {
    id: string;
    controlNumber: number;
    sku: string;
    name: string;
    description: string | null;
    type: ProductType;
    unit: string;
    minStockQty: { toString(): string };
    salePrice: { toString(): string } | null;
    ncm: string | null;
    fiscalOrigin: string | null;
    fiscalCst: string | null;
    fiscalSituationId: string | null;
    groupId: string | null;
    group: { id: string; code: string; name: string } | null;
    fiscalSituation: { id: string; code: string; description: string } | null;
  },
  costMap: Map<string, { qty: number; averageCost: number }>,
) {
  const cost = costMap.get(p.id);
  const averageCost = cost?.averageCost ?? 0;
  const salePrice = p.salePrice != null ? dec(p.salePrice) : null;
  const profit =
    salePrice != null && salePrice > 0 ? salePrice - averageCost : salePrice != null ? salePrice - averageCost : null;
  const profitMarginPct =
    salePrice != null && salePrice > 0 && profit != null ? (profit / salePrice) * 100 : null;

  return {
    id: p.id,
    controlNumber: p.controlNumber,
    sku: p.sku,
    name: p.name,
    description: p.description,
    type: p.type,
    unit: p.unit,
    minStockQty: dec(p.minStockQty),
    groupId: p.groupId,
    group: p.group,
    salePrice,
    averageCost,
    stockQty: cost?.qty ?? 0,
    profit,
    profitMarginPct,
    ncm: p.ncm,
    fiscalOrigin: p.fiscalOrigin,
    fiscalCst: p.fiscalCst,
    fiscalSituationId: p.fiscalSituationId,
    fiscalSituation: p.fiscalSituation,
  };
}

@Injectable()
export class InventoryService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private async costMapForProducts(
    prisma: Prisma.TransactionClient | Awaited<ReturnType<TenantPrismaService['getClient']>>,
    productIds: string[],
  ) {
    if (productIds.length === 0) return new Map<string, { qty: number; averageCost: number }>();
    const moves = await prisma.stockMovement.findMany({
      where: { productId: { in: productIds } },
      orderBy: [{ movedAt: 'asc' }, { id: 'asc' }],
      select: { productId: true, type: true, quantity: true, unitCost: true },
    });
    return averageCostByProduct(moves);
  }

  private async recordSalePriceChange(
    tx: Prisma.TransactionClient,
    productId: string,
    newPrice: number | null | undefined,
    previousPrice: number | null,
    userId: string,
    source: 'create' | 'update',
  ) {
    if (newPrice == null || !Number.isFinite(newPrice)) return;
    const prev = previousPrice != null ? previousPrice : null;
    if (prev != null && Math.abs(prev - newPrice) < 0.0001) return;
    await tx.productPriceHistory.create({
      data: {
        productId,
        salePrice: newPrice,
        previousPrice: prev,
        source,
        userId,
      },
    });
  }

  async listProductGroups(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.productGroup.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async createProductGroup(user: JwtPayload, dto: CreateProductGroupDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    let code = dto.code?.trim() || slugCode(dto.name);
    const existingCode = await prisma.productGroup.findUnique({ where: { code } });
    if (existingCode) {
      code = `${code}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }
    return prisma.productGroup.create({
      data: { code, name: dto.name.trim() },
    });
  }

  async listProducts(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const products = await prisma.product.findMany({
      orderBy: { name: 'asc' },
      include: {
        group: { select: { id: true, code: true, name: true } },
        fiscalSituation: { select: { id: true, code: true, description: true } },
      },
    });
    const costMap = await this.costMapForProducts(
      prisma,
      products.map((p) => p.id),
    );
    return products.map((p) => mapProductRow(p, costMap));
  }

  async listProductPriceHistory(user: JwtPayload, productId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.productPriceHistory.findMany({
      where: { productId },
      orderBy: { recordedAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      salePrice: dec(r.salePrice),
      previousPrice: r.previousPrice != null ? dec(r.previousPrice) : null,
      recordedAt: r.recordedAt.toISOString(),
      source: r.source,
    }));
  }

  async createProduct(user: JwtPayload, dto: CreateProductDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          sku: dto.sku,
          name: dto.name,
          description: dto.description?.trim() || undefined,
          type: dto.type as ProductType,
          unit: dto.unit ?? 'UN',
          minStockQty: dto.minStockQty ?? 0,
          groupId: dto.groupId || undefined,
          salePrice: dto.salePrice ?? undefined,
          fiscalSituationId: dto.fiscalSituationId,
          ncm: dto.ncm,
          fiscalOrigin: dto.fiscalOrigin,
          fiscalCst: dto.fiscalCst,
        },
        include: {
          group: { select: { id: true, code: true, name: true } },
          fiscalSituation: { select: { id: true, code: true, description: true } },
        },
      });
      if (dto.salePrice != null) {
        await this.recordSalePriceChange(tx, created.id, dto.salePrice, null, user.sub, 'create');
      }
      const costMap = await this.costMapForProducts(tx, [created.id]);
      return mapProductRow(created, costMap);
    });
  }

  async listStockReceipts(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.stockReceipt.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 200,
      include: { partner: true, stockLocation: true, items: { include: { product: true } } },
    });
  }

  async createStockReceipt(
    user: JwtPayload,
    data: {
      partnerId: string;
      invoiceNumber?: string;
      invoiceSeries?: string;
      issuedAt?: string;
      nfeAccessKey?: string;
      mode?: 'NFE_KEY' | 'MANUAL';
      stockLocationId?: string;
      chartAccountId?: string;
      notes?: string;
      purchaseOrderId?: string;
      items: { productId: string; quantity: number; unitCost: number; batchCode?: string; expiresAt?: string }[];
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const total = data.items.reduce((s, i) => s + i.quantity * i.unitCost, 0);
    return prisma.$transaction(async (tx) => {
      const receipt = await tx.stockReceipt.create({
        data: {
          partnerId: data.partnerId,
          purchaseOrderId: data.purchaseOrderId,
          invoiceNumber: data.invoiceNumber,
          invoiceSeries: data.invoiceSeries,
          issuedAt: data.issuedAt ? new Date(data.issuedAt) : undefined,
          nfeAccessKey: data.nfeAccessKey,
          mode: data.mode ?? (data.nfeAccessKey ? 'NFE_KEY' : 'MANUAL'),
          stockLocationId: data.stockLocationId,
          chartAccountId: data.chartAccountId,
          totalAmount: total,
          notes: data.notes,
          items: {
            create: data.items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitCost: i.unitCost,
              batchCode: i.batchCode,
              expiresAt: i.expiresAt ? new Date(i.expiresAt) : undefined,
            })),
          },
        },
        include: { items: true },
      });
      const accountId = data.chartAccountId ?? (await defaultStockChartAccountId(tx));
      for (const item of receipt.items) {
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            chartAccountId: accountId,
            stockLocationId: data.stockLocationId,
            type: 'IN',
            quantity: item.quantity,
            unitCost: item.unitCost,
            reference: `entrada:${receipt.id}`,
          },
        });
      }
      return receipt;
    });
  }

  async moveStock(user: JwtPayload, dto: StockMovementDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.stockMovement.create({
      data: {
        productId: dto.productId,
        chartAccountId: dto.chartAccountId,
        type: dto.type as StockMovementType,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
        reference: dto.reference,
      },
    });
  }

  async listMovements(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.stockMovement.findMany({
      orderBy: { movedAt: 'desc' },
      take: 500,
      include: {
        product: { select: { sku: true, name: true } },
        chartAccount: { select: { code: true, name: true } },
      },
    });

    const saleOrderIds = [
      ...new Set(
        rows
          .map((m) => this.salesOrderIdFromMovementReference(m.reference))
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const orders =
      saleOrderIds.length > 0
        ? await prisma.salesOrder.findMany({
            where: { id: { in: saleOrderIds } },
            select: { id: true, partner: { select: { name: true } } },
          })
        : [];
    const partnerByOrderId = new Map(orders.map((o) => [o.id, o.partner.name]));

    return rows.map((m) => {
      const saleId = this.salesOrderIdFromMovementReference(m.reference);
      return {
        ...m,
        partnerName: saleId ? (partnerByOrderId.get(saleId) ?? null) : null,
      };
    });
  }

  private salesOrderIdFromMovementReference(reference: string | null | undefined): string | null {
    if (!reference) return null;
    const m = /^venda:([0-9a-f-]{36})$/i.exec(reference.trim());
    return m?.[1] ?? null;
  }

  async updateProduct(user: JwtPayload, id: string, data: UpdateProductDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const current = await prisma.product.findUnique({ where: { id } });
    if (!current) throw new BadRequestException('Produto não encontrado');

    const prevSale = current.salePrice != null ? dec(current.salePrice) : null;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.product.update({
        where: { id },
        data: {
          name: data.name?.trim(),
          description: data.description === null ? null : data.description?.trim(),
          groupId: data.groupId === null ? null : data.groupId,
          minStockQty: data.minStockQty,
          salePrice: data.salePrice === null ? null : data.salePrice,
          fiscalSituationId: data.fiscalSituationId === null ? null : data.fiscalSituationId,
          ncm: data.ncm === null ? null : data.ncm,
          fiscalOrigin: data.fiscalOrigin === null ? null : data.fiscalOrigin,
          fiscalCst: data.fiscalCst === null ? null : data.fiscalCst,
        },
        include: {
          group: { select: { id: true, code: true, name: true } },
          fiscalSituation: { select: { id: true, code: true, description: true } },
        },
      });

      if (data.salePrice !== undefined) {
        await this.recordSalePriceChange(tx, id, data.salePrice, prevSale, user.sub, 'update');
      }

      const costMap = await this.costMapForProducts(tx, [id]);
      return mapProductRow(updated, costMap);
    });
  }

  async stockBalance(user: JwtPayload, productId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const moves = await prisma.stockMovement.findMany({ where: { productId } });
    let balance = 0;
    for (const m of moves) {
      const q = Number(m.quantity);
      if (m.type === 'OUT') balance -= q;
      else balance += q;
    }
    return { productId, balance };
  }
}
