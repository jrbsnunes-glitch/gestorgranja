import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { AlertStatus, AlertType, PurchaseRequestStatus } from '../generated/tenant-client';
import { InventoryService } from '../inventory/inventory.service';
import { parsePaymentTerms } from '../finance/finance-title-utils';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

type RequestItemInput = { productId: string; quantity: number };
type QuoteItemInput = { productId: string; unitPrice: number };

function dec(n: { toString(): string } | number): number {
  return Number(n);
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class PurchasingService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly inventory: InventoryService,
  ) {}

  private readonly requestInclude = {
    items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
    quotes: {
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
      },
    },
    order: {
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true, unit: true } } } },
        receipt: true,
      },
    },
  } as const;

  async listRequests(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.purchaseRequest.findMany({
      orderBy: { requestedAt: 'desc' },
      include: this.requestInclude,
    });
  }

  async createRequest(user: JwtPayload, code: string, description: string, items: RequestItemInput[]) {
    if (!items?.length) throw new BadRequestException('Informe ao menos um produto na requisição');
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    await this.assertProducts(prisma, items);
    return prisma.purchaseRequest.create({
      data: {
        code,
        description,
        status: PurchaseRequestStatus.DRAFT,
        items: {
          create: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        },
      },
      include: this.requestInclude,
    });
  }

  async updateRequestItems(user: JwtPayload, requestId: string, items: RequestItemInput[]) {
    if (!items?.length) throw new BadRequestException('Informe ao menos um produto');
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const req = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: { order: true },
    });
    if (!req) throw new NotFoundException('Requisição não encontrada');
    if (req.order) throw new BadRequestException('Não é possível alterar itens após gerar o pedido');
    await this.assertProducts(prisma, items);
    await prisma.purchaseRequestItem.deleteMany({ where: { purchaseRequestId: requestId } });
    await prisma.purchaseRequestItem.createMany({
      data: items.map((i) => ({ purchaseRequestId: requestId, productId: i.productId, quantity: i.quantity })),
    });
    return prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: this.requestInclude,
    });
  }

  async addQuote(
    user: JwtPayload,
    requestId: string,
    supplierName: string,
    partnerId: string | undefined,
    totalAmount: number,
    items: QuoteItemInput[],
    paymentTermsJson?: unknown,
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const req = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: { items: true, order: true },
    });
    if (!req) throw new NotFoundException('Requisição não encontrada');
    if (req.order) throw new BadRequestException('Pedido já gerado para esta requisição');
    if (!req.items.length) throw new BadRequestException('Cadastre itens na requisição antes de cotar');

    const reqByProduct = new Map(req.items.map((i) => [i.productId, dec(i.quantity)]));
    if (items.length !== req.items.length) {
      throw new BadRequestException('A cotação deve precificar todos os produtos da requisição');
    }

    const quoteLines: { productId: string; quantity: number; unitPrice: number }[] = [];
    let computed = 0;
    for (const line of items) {
      const qty = reqByProduct.get(line.productId);
      if (qty == null) throw new BadRequestException('Produto não pertence à requisição');
      if (line.unitPrice < 0) throw new BadRequestException('Preço unitário inválido');
      quoteLines.push({ productId: line.productId, quantity: qty, unitPrice: line.unitPrice });
      computed += qty * line.unitPrice;
    }
    computed = roundMoney(computed);
    if (Math.abs(computed - roundMoney(totalAmount)) > 0.02) {
      throw new BadRequestException(
        `Valor total (R$ ${totalAmount.toFixed(2)}) não confere com a soma dos itens (R$ ${computed.toFixed(2)})`,
      );
    }

    const quote = await prisma.purchaseQuote.create({
      data: {
        purchaseRequestId: requestId,
        supplierName,
        partnerId: partnerId || null,
        totalAmount: computed,
        paymentTermsJson: paymentTermsJson ?? undefined,
        items: { create: quoteLines },
      },
      include: { items: { include: { product: true } } },
    });

    await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: { status: PurchaseRequestStatus.QUOTING },
    });

    return quote;
  }

  async selectQuoteAndOrder(
    user: JwtPayload,
    requestId: string,
    quoteId: string,
    orderNumber: string,
    opts?: { financeApproved?: boolean; highImpact?: boolean },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const req = await prisma.purchaseRequest.findUnique({
      where: { id: requestId },
      include: { items: true },
    });
    if (!req) throw new NotFoundException('Requisição não encontrada');

    const quote = await prisma.purchaseQuote.findUnique({
      where: { id: quoteId },
      include: { items: true },
    });
    if (!quote) throw new NotFoundException('Cotação não encontrada');
    if (quote.purchaseRequestId !== requestId) throw new BadRequestException('Cotação não pertence à requisição');
    if (!quote.items.length) throw new BadRequestException('Cotação sem itens — registre uma cotação completa');

    await prisma.purchaseQuote.updateMany({
      where: { purchaseRequestId: requestId },
      data: { selected: false },
    });
    await prisma.purchaseQuote.update({ where: { id: quoteId }, data: { selected: true } });
    await prisma.purchaseRequest.update({
      where: { id: requestId },
      data: { status: PurchaseRequestStatus.ORDERED },
    });

    const order = await prisma.purchaseOrder.create({
      data: {
        purchaseRequestId: requestId,
        orderNumber,
        paymentTermsJson: quote.paymentTermsJson ?? undefined,
        financeApprovedAt: opts?.financeApproved ? new Date() : undefined,
        financeApprovedByUserId: opts?.financeApproved ? user.sub : undefined,
        items: {
          create: quote.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });

    if (opts?.highImpact) {
      const exists = await prisma.alert.findFirst({
        where: { type: AlertType.PURCHASE_CASH_IMPACT, referenceId: order.id, status: AlertStatus.OPEN },
      });
      if (!exists) {
        await prisma.alert.create({
          data: {
            type: AlertType.PURCHASE_CASH_IMPACT,
            title: 'Compra com impacto elevado no caixa',
            message: `Pedido ${orderNumber} — ${quote.supplierName}`,
            referenceId: order.id,
          },
        });
      }
    }

    return order;
  }

  async updateQuotePaymentTerms(user: JwtPayload, quoteId: string, paymentTermsJson: unknown) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const quote = await prisma.purchaseQuote.findUnique({ where: { id: quoteId } });
    if (!quote) throw new NotFoundException('Cotação não encontrada');
    const terms = parsePaymentTerms(paymentTermsJson);
    if (!terms.length) throw new BadRequestException('Parcelas inválidas');
    return prisma.purchaseQuote.update({
      where: { id: quoteId },
      data: { paymentTermsJson: terms },
    });
  }

  async receive(
    user: JwtPayload,
    orderId: string,
    data: {
      notes?: string;
      partnerId: string;
      stockLocationId?: string;
      chartAccountId?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { product: true } },
        purchaseRequest: true,
        receipt: true,
        stockReceipt: true,
      },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.receipt) throw new BadRequestException('Pedido já recebido');
    if (!order.items.length) throw new BadRequestException('Pedido sem itens de produto');

    const partner = await prisma.partner.findUnique({ where: { id: data.partnerId } });
    if (!partner) throw new BadRequestException('Fornecedor inválido');

    const stockReceipt = await this.inventory.createStockReceipt(user, {
      partnerId: data.partnerId,
      stockLocationId: data.stockLocationId,
      chartAccountId: data.chartAccountId,
      purchaseOrderId: orderId,
      notes: data.notes ?? `Recebimento pedido ${order.orderNumber}`,
      items: order.items.map((i) => ({
        productId: i.productId,
        quantity: dec(i.quantity),
        unitCost: dec(i.unitPrice),
      })),
    });

    await prisma.purchaseRequest.update({
      where: { id: order.purchaseRequestId },
      data: { status: PurchaseRequestStatus.RECEIVED },
    });

    return prisma.goodsReceipt.create({
      data: {
        purchaseOrderId: orderId,
        stockReceiptId: stockReceipt.id,
        notes: data.notes,
      },
    });
  }

  private async assertProducts(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    items: RequestItemInput[],
  ) {
    const ids = [...new Set(items.map((i) => i.productId))];
    if (ids.length !== items.length) throw new BadRequestException('Produto duplicado na requisição');
    for (const i of items) {
      if (!(i.quantity > 0)) throw new BadRequestException('Quantidade deve ser maior que zero');
    }
    const found = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true } });
    if (found.length !== ids.length) throw new BadRequestException('Produto não encontrado no cadastro');
  }
}
