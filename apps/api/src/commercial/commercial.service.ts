import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashSessionStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class CommercialService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  listOrders(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug).then((p) =>
      p.salesOrder.findMany({
        orderBy: { orderDate: 'desc' },
        take: 200,
        include: { partner: true, items: { include: { product: true } } },
      }),
    );
  }

  async createOrder(
    user: JwtPayload,
    data: {
      partnerId: string;
      paymentMethod?: string;
      items: { productId?: string; eggCategory?: string; quantity: number; unitPrice: number; discount?: number }[];
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const total = data.items.reduce(
      (s, i) => s + i.quantity * i.unitPrice - (i.discount ?? 0),
      0,
    );
    return prisma.salesOrder.create({
      data: {
        partnerId: data.partnerId,
        paymentMethod: data.paymentMethod,
        totalAmount: total,
        items: {
          create: data.items.map((i) => ({
            productId: i.productId,
            eggCategory: i.eggCategory,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount ?? 0,
          })),
        },
      },
      include: { items: true, partner: true },
    });
  }

  async confirmOrder(user: JwtPayload, orderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new BadRequestException('Pedido não encontrado');
    if (order.status !== 'DRAFT') throw new BadRequestException('Pedido já confirmado');

    const session = await prisma.cashRegisterSession.findFirst({
      where: { userId: user.sub, status: CashSessionStatus.OPEN },
    });
    if (!session) throw new BadRequestException('Abra o caixa antes de confirmar vendas');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED', cashSessionId: session.id },
        include: { items: true, partner: true },
      });
      await tx.cashMovement.create({
        data: {
          sessionId: session.id,
          type: 'IN',
          amount: Number(updated.totalAmount),
          paymentMethod: updated.paymentMethod ?? 'CASH',
          reason: `Venda ${updated.id.slice(0, 8)}`,
        },
      });
      for (const item of updated.items) {
        if (item.productId) {
          const stockAccount = await tx.chartAccount.findFirst({
            where: { code: '1.1.3.04', isActive: true, isPosting: true },
          });
          if (stockAccount) {
            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                chartAccountId: stockAccount.id,
                type: 'OUT',
                quantity: item.quantity,
                reference: `venda:${orderId}`,
              },
            });
          }
        }
      }
      return updated;
    });
  }
}
