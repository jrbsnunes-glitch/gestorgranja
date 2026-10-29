import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashSessionStatus } from '../generated/tenant-client';
import { SicoobCobrancaService } from '../finance/sicoob-cobranca.service';
import { calendarDayKeyInTz, monthDayKeysInTz, prismaDateOnly } from '../common/calendar-date.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CommercialRequisitionService } from './commercial-requisition.service';
import { isRequisicaoKind } from './requisition.util';

function isBoletoKind(kind?: string | null) {
  return (kind ?? '').toUpperCase() === 'BOLETO';
}

function skipsCashInflow(kind?: string | null) {
  return isBoletoKind(kind) || isRequisicaoKind(kind);
}

function isCashKind(kind?: string | null) {
  return (kind ?? '').toUpperCase() === 'CASH';
}

function cashDueForOrder(
  total: number,
  primaryKind: string | null | undefined,
  secondaryKind: string | null | undefined,
  primaryPaymentAmount: number | null,
): { hasCash: boolean; cashDue: number } {
  if (!secondaryKind) {
    return isCashKind(primaryKind)
      ? { hasCash: true, cashDue: total }
      : { hasCash: false, cashDue: 0 };
  }
  const primaryAmt = primaryPaymentAmount ?? 0;
  let cashDue = 0;
  if (isCashKind(primaryKind)) cashDue += primaryAmt;
  if (isCashKind(secondaryKind)) {
    cashDue += Math.round((total - primaryAmt) * 100) / 100;
  }
  return { hasCash: cashDue > 0.004, cashDue: Math.round(cashDue * 100) / 100 };
}

type SalesStatsBucket = { noAto: number; requisicao: number; boleto: number };

function isRequisicaoPayment(kind?: string | null, name?: string | null) {
  return isRequisicaoKind(kind) || Boolean(name && /requis/i.test(name));
}

function paymentBucket(kind?: string | null, name?: string | null): keyof SalesStatsBucket {
  if (isBoletoKind(kind)) return 'boleto';
  if (isRequisicaoPayment(kind, name)) return 'requisicao';
  return 'noAto';
}

function emptyBuckets(): SalesStatsBucket {
  return { noAto: 0, requisicao: 0, boleto: 0 };
}

function addToBuckets(
  buckets: SalesStatsBucket,
  order: {
    totalAmount: { toString(): string };
    paymentMethod: string | null;
    paymentForm: { kind: string; name: string } | null;
    secondaryPaymentForm: { kind: string; name: string } | null;
    primaryPaymentAmount: { toString(): string } | null;
    secondaryPaymentFormId: string | null;
  },
) {
  const total = Number(order.totalAmount);
  const slices: { kind: string | null; name: string | null; amount: number }[] =
    order.secondaryPaymentFormId && order.primaryPaymentAmount != null
      ? [
          {
            kind: order.paymentMethod ?? order.paymentForm?.kind ?? null,
            name: order.paymentForm?.name ?? null,
            amount: Number(order.primaryPaymentAmount),
          },
          {
            kind: order.secondaryPaymentForm?.kind ?? null,
            name: order.secondaryPaymentForm?.name ?? null,
            amount: Math.round((total - Number(order.primaryPaymentAmount)) * 100) / 100,
          },
        ]
      : [
          {
            kind: order.paymentMethod ?? order.paymentForm?.kind ?? null,
            name: order.paymentForm?.name ?? null,
            amount: total,
          },
        ];

  for (const s of slices) {
    const key = paymentBucket(s.kind, s.name);
    buckets[key] = Math.round((buckets[key] + s.amount) * 100) / 100;
  }
}

function aggregateSalesStats(
  rows: {
    totalAmount: { toString(): string };
    paymentMethod: string | null;
    paymentForm: { kind: string; name: string } | null;
    secondaryPaymentForm: { kind: string; name: string } | null;
    primaryPaymentAmount: { toString(): string } | null;
    secondaryPaymentFormId: string | null;
  }[],
) {
  const buckets = emptyBuckets();
  for (const row of rows) addToBuckets(buckets, row);
  const sum = (r: typeof rows) =>
    Math.round(r.reduce((s, x) => s + Number(x.totalAmount), 0) * 100) / 100;
  return { count: rows.length, totalAmount: sum(rows), ...buckets };
}

@Injectable()
export class CommercialService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly sicoob: SicoobCobrancaService,
    private readonly requisition: CommercialRequisitionService,
  ) {}

  async listOrders(user: JwtPayload) {
    const p = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await p.salesOrder.findMany({
      orderBy: { orderDate: 'desc' },
      take: 200,
      include: {
        partner: true,
        items: { include: { product: true } },
        fiscalDoc: true,
        boletos: { orderBy: { createdAt: 'desc' }, take: 1 },
        paymentForm: true,
        secondaryPaymentForm: true,
      },
    });
    return rows.map((o) => ({
      ...o,
      boletos: o.boletos.map((b) => this.sicoob.toBoletoDto(b)),
    }));
  }

  async getSalesStats(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const now = new Date();
    const dayKey = calendarDayKeyInTz(now);
    const monthKeys = monthDayKeysInTz(now);
    const dayDate = prismaDateOnly(dayKey);
    const monthFrom = prismaDateOnly(monthKeys.from);
    const monthTo = prismaDateOnly(monthKeys.to);

    const orderSelect = {
      totalAmount: true,
      paymentMethod: true,
      primaryPaymentAmount: true,
      secondaryPaymentFormId: true,
      paymentForm: { select: { kind: true, name: true } },
      secondaryPaymentForm: { select: { kind: true, name: true } },
    } as const;

    const [dayOrders, monthOrders] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { status: 'CONFIRMED', orderDate: dayDate, cashSessionId: { not: null } },
        select: orderSelect,
      }),
      prisma.salesOrder.findMany({
        where: {
          status: 'CONFIRMED',
          orderDate: { gte: monthFrom, lte: monthTo },
          cashSessionId: { not: null },
        },
        select: orderSelect,
      }),
    ]);

    return {
      day: aggregateSalesStats(dayOrders),
      month: aggregateSalesStats(monthOrders),
    };
  }

  private async resolvePayment(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    data: { paymentMethod?: string; paymentFormId?: string },
  ) {
    if (data.paymentFormId) {
      const form = await prisma.paymentForm.findFirst({
        where: { id: data.paymentFormId, isActive: true },
      });
      if (!form) throw new BadRequestException('Forma de pagamento inválida ou inativa');
      return { paymentMethod: form.kind, paymentFormId: form.id };
    }
    return { paymentMethod: data.paymentMethod ?? 'CASH', paymentFormId: null as string | null };
  }

  async createOrder(
    user: JwtPayload,
    data: {
      partnerId: string;
      paymentMethod?: string;
      paymentFormId?: string;
      primaryPaymentAmount?: number;
      secondaryPaymentFormId?: string;
      requisitionTerms?: unknown;
      cashTendered?: number;
      items: { productId?: string; eggCategory?: string; quantity: number; unitPrice: number; discount?: number }[];
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const pay = await this.resolvePayment(prisma, data);
    const total = Math.round(
      data.items.reduce((s, i) => s + i.quantity * i.unitPrice - (i.discount ?? 0), 0) * 100,
    ) / 100;

    let primaryPaymentAmount: number | null = null;
    let secondaryPaymentFormId: string | null = null;

    if (data.secondaryPaymentFormId) {
      if (!data.paymentFormId) throw new BadRequestException('Informe a primeira forma de pagamento');
      if (data.secondaryPaymentFormId === data.paymentFormId) {
        throw new BadRequestException('Escolha formas de pagamento diferentes');
      }
      const secondary = await this.resolvePayment(prisma, { paymentFormId: data.secondaryPaymentFormId });
      if (!secondary.paymentFormId) throw new BadRequestException('Segunda forma de pagamento inválida');

      const primaryAmt = data.primaryPaymentAmount;
      if (primaryAmt == null || !Number.isFinite(primaryAmt) || primaryAmt <= 0) {
        throw new BadRequestException('Informe o valor pago na primeira forma');
      }
      const primaryRounded = Math.round(primaryAmt * 100) / 100;
      if (primaryRounded >= total - 0.004) {
        throw new BadRequestException('Com pagamento dividido, o valor da 1ª forma deve ser menor que o total');
      }
      if (total - primaryRounded < 0.01) {
        throw new BadRequestException('Valor da segunda forma deve ser pelo menos R$ 0,01');
      }
      primaryPaymentAmount = primaryRounded;
      secondaryPaymentFormId = secondary.paymentFormId;
    }

    let requisitionTermsJson: object | undefined;
    const payKind = pay.paymentMethod;
    const secondaryKind = secondaryPaymentFormId
      ? (
          await prisma.paymentForm.findUnique({
            where: { id: secondaryPaymentFormId },
            select: { kind: true },
          })
        )?.kind
      : null;
    const needsRequisition =
      isRequisicaoKind(payKind) ||
      (secondaryPaymentFormId != null && isRequisicaoKind(secondaryKind));
    if (needsRequisition) {
      if (!data.requisitionTerms) {
        throw new BadRequestException('Informe parcelas, prazos e data da 1ª parcela da requisição.');
      }
      requisitionTermsJson = this.requisition.termsFromInput(data.requisitionTerms) as object;
      const reqAmount =
        isRequisicaoKind(payKind) && !isRequisicaoKind(secondaryKind)
          ? primaryPaymentAmount ?? total
          : isRequisicaoKind(secondaryKind)
            ? Math.round((total - (primaryPaymentAmount ?? 0)) * 100) / 100
            : total;
      await this.requisition.assertCanUseRequisition(user, data.partnerId, reqAmount);
    } else if (data.requisitionTerms) {
      throw new BadRequestException('Parcelas de requisição só se aplicam à forma Requisição.');
    }

    const { hasCash, cashDue } = cashDueForOrder(
      total,
      payKind,
      secondaryKind,
      primaryPaymentAmount,
    );
    let cashTenderedAmount: number | null = null;
    let cashChangeAmount: number | null = null;
    let cashDueAmount: number | null = null;
    if (hasCash && data.cashTendered != null && Number.isFinite(Number(data.cashTendered))) {
      const tendered = Math.round(Number(data.cashTendered) * 100) / 100;
      if (tendered + 0.004 < cashDue) {
        throw new BadRequestException('Valor recebido em dinheiro é menor que o devido.');
      }
      cashTenderedAmount = tendered;
      cashDueAmount = cashDue;
      cashChangeAmount = Math.max(0, Math.round((tendered - cashDue) * 100) / 100);
    }

    return prisma.salesOrder.create({
      data: {
        partnerId: data.partnerId,
        paymentMethod: pay.paymentMethod,
        paymentFormId: pay.paymentFormId,
        primaryPaymentAmount,
        secondaryPaymentFormId,
        requisitionTermsJson,
        cashTenderedAmount,
        cashChangeAmount,
        cashDueAmount,
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

  async confirmOrder(
    user: JwtPayload,
    orderId: string,
    boletoTerms?: {
      dueDate: string;
      tipoMulta: number;
      valorMulta?: number | null;
      tipoJurosMora: number;
      valorJurosMora?: number | null;
      diasInicioMultaAposVencimento?: number;
      diasInicioJurosAposVencimento?: number;
      diasLimitePagamentoAposVencimento?: number | null;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) throw new BadRequestException('Pedido não encontrado');
    if (order.status !== 'DRAFT') throw new BadRequestException('Pedido já confirmado');

    const session = await prisma.cashRegisterSession.findFirst({
      where: { userId: user.sub, status: CashSessionStatus.OPEN },
    });
    if (!session) throw new BadRequestException('Abra o caixa antes de confirmar vendas');

    const updated = await prisma.$transaction(async (tx) => {
      const updated = await tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CONFIRMED', cashSessionId: session.id },
        include: { items: true, partner: true, paymentForm: true, secondaryPaymentForm: true },
      });
      const saleRef = `Venda ${updated.controlNumber}`;
      const total = Number(updated.totalAmount);
      if (updated.secondaryPaymentFormId && updated.primaryPaymentAmount != null) {
        const primaryAmt = Number(updated.primaryPaymentAmount);
        const secondaryAmt = Math.round((total - primaryAmt) * 100) / 100;
        const secondaryForm = await tx.paymentForm.findUnique({
          where: { id: updated.secondaryPaymentFormId },
        });
        if (!skipsCashInflow(updated.paymentMethod)) {
          await tx.cashMovement.create({
            data: {
              sessionId: session.id,
              type: 'IN',
              amount: primaryAmt,
              paymentMethod: updated.paymentMethod ?? 'CASH',
              reason: `${saleRef} (1/2)`,
            },
          });
        }
        if (!skipsCashInflow(secondaryForm?.kind)) {
          await tx.cashMovement.create({
            data: {
              sessionId: session.id,
              type: 'IN',
              amount: secondaryAmt,
              paymentMethod: secondaryForm?.kind ?? 'CASH',
              reason: `${saleRef} (2/2)`,
            },
          });
        }
      } else if (!skipsCashInflow(updated.paymentMethod)) {
        await tx.cashMovement.create({
          data: {
            sessionId: session.id,
            type: 'IN',
            amount: total,
            paymentMethod: updated.paymentMethod ?? 'CASH',
            reason: saleRef,
          },
        });
      }
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
    const boleto = await this.sicoob.afterSaleConfirmed(user, orderId, boletoTerms);
    const requisitionReceivables = await this.requisition.createReceivablesForOrder(user, orderId);
    return { ...updated, boleto, requisitionReceivables };
  }

  /** Estorna venda confirmada (estoque + caixa). Não disponível com NF autorizada ou boleto emitido. */
  async voidOrder(user: JwtPayload, orderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        fiscalDoc: true,
        boletos: { where: { status: { not: 'CANCELLED' } }, take: 1 },
        paymentForm: true,
        secondaryPaymentForm: true,
      },
    });
    if (!order) throw new BadRequestException('Pedido não encontrado');
    if (order.status !== 'CONFIRMED') {
      throw new BadRequestException('Só é possível estornar vendas confirmadas');
    }
    const fiscalStatus = order.fiscalDoc?.status?.toUpperCase();
    if (fiscalStatus && !['DRAFT', 'REJECTED', 'CANCELLED', 'CANCELED'].includes(fiscalStatus)) {
      throw new BadRequestException('Venda com documento fiscal autorizado — cancele a NF antes de estornar');
    }
    if (order.boletos.length > 0) {
      throw new BadRequestException('Estorne ou cancele o boleto antes de anular a venda');
    }

    const estornoRef = `Estorno ${order.controlNumber}`;

    return prisma.$transaction(async (tx) => {
      await this.requisition.cancelReceivablesForOrder(tx, orderId);
      const stockAccount = await tx.chartAccount.findFirst({
        where: { code: '1.1.3.04', isActive: true, isPosting: true },
      });

      for (const item of order.items) {
        if (item.productId && stockAccount) {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              chartAccountId: stockAccount.id,
              type: 'IN',
              quantity: item.quantity,
              reference: `estorno:venda:${orderId}`,
            },
          });
        }
      }

      if (order.cashSessionId) {
        const total = Number(order.totalAmount);
        if (order.secondaryPaymentFormId && order.primaryPaymentAmount != null) {
          const primaryAmt = Number(order.primaryPaymentAmount);
          const secondaryAmt = Math.round((total - primaryAmt) * 100) / 100;
          if (!skipsCashInflow(order.paymentMethod)) {
            await tx.cashMovement.create({
              data: {
                sessionId: order.cashSessionId,
                type: 'OUT',
                amount: primaryAmt,
                paymentMethod: order.paymentMethod ?? 'CASH',
                reason: `${estornoRef} (1/2)`,
              },
            });
          }
          if (!skipsCashInflow(order.secondaryPaymentForm?.kind)) {
            await tx.cashMovement.create({
              data: {
                sessionId: order.cashSessionId,
                type: 'OUT',
                amount: secondaryAmt,
                paymentMethod: order.secondaryPaymentForm?.kind ?? 'CASH',
                reason: `${estornoRef} (2/2)`,
              },
            });
          }
        } else if (!skipsCashInflow(order.paymentMethod)) {
          await tx.cashMovement.create({
            data: {
              sessionId: order.cashSessionId,
              type: 'OUT',
              amount: total,
              paymentMethod: order.paymentMethod ?? 'CASH',
              reason: estornoRef,
            },
          });
        }
      }

      return tx.salesOrder.update({
        where: { id: orderId },
        data: { status: 'CANCELLED' },
        include: { partner: true, items: true },
      });
    });
  }

  async getOrderReceipt(user: JwtPayload, orderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({
      where: { id: orderId },
      include: {
        partner: true,
        paymentForm: true,
        secondaryPaymentForm: true,
        items: { include: { product: true } },
      },
    });
    if (!order) throw new BadRequestException('Venda não encontrada');
    const company = await prisma.company.findFirst();
    const subtotal = order.items.reduce(
      (s, i) => s + Number(i.quantity) * Number(i.unitPrice),
      0,
    );
    const discount = order.items.reduce((s, i) => s + Number(i.discount), 0);
    const fmtBrl = (n: number) =>
      n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const labelForForm = (name: string | undefined, kind: string | null | undefined) =>
      name ??
      (kind === 'CASH'
        ? 'Dinheiro'
        : kind === 'PIX'
          ? 'PIX'
          : kind === 'CARD'
            ? 'Cartão'
            : kind === 'TRANSFER'
              ? 'Transferência'
              : kind === 'BOLETO'
                ? 'Boleto'
                : kind === 'REQUISICAO'
                  ? 'Requisição'
                  : kind ?? '—');
    let paymentLabel = labelForForm(order.paymentForm?.name, order.paymentMethod);
    if (order.secondaryPaymentFormId && order.primaryPaymentAmount != null) {
      const primaryAmt = Number(order.primaryPaymentAmount);
      const secondaryAmt = Number(order.totalAmount) - primaryAmt;
      const p1 = labelForForm(order.paymentForm?.name, order.paymentMethod);
      const p2 = labelForForm(
        order.secondaryPaymentForm?.name,
        order.secondaryPaymentForm?.kind,
      );
      paymentLabel = `${p1} ${fmtBrl(primaryAmt)} + ${p2} ${fmtBrl(secondaryAmt)}`;
    }
    return {
      sale: {
        id: order.id,
        controlNumber: order.controlNumber,
        status: order.status,
        orderDate: order.orderDate,
        totalAmount: Number(order.totalAmount),
        subtotal,
        discount,
        paymentLabel,
        cashTendered:
          order.cashTenderedAmount != null ? Number(order.cashTenderedAmount) : null,
        cashChange: order.cashChangeAmount != null ? Number(order.cashChangeAmount) : null,
        cashDue: order.cashDueAmount != null ? Number(order.cashDueAmount) : null,
        partnerName: order.partner.name,
        items: order.items.map((i) => ({
          sku: i.product?.sku ?? '—',
          name: i.product?.name ?? i.eggCategory ?? 'Item',
          unit: i.product?.unit ?? 'UN',
          quantity: Number(i.quantity),
          unitPrice: Number(i.unitPrice),
          discount: Number(i.discount),
          lineTotal: Number(i.quantity) * Number(i.unitPrice) - Number(i.discount),
        })),
      },
      company: company
        ? {
            legalName: company.legalName,
            tradeName: company.tradeName,
            cnpj: company.cnpj,
            stateReg: company.stateReg,
            address: company.address,
            phone: company.phone,
            city: company.city,
            state: company.state,
            zipCode: company.zipCode,
            logoUrl: company.logoUrl ?? '/v1/cadastros/company/logo',
          }
        : null,
    };
  }
}
