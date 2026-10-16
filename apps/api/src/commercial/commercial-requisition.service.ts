import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { PaymentApprovalStatus, Prisma } from '../generated/tenant-client';
import { chartAccountAllowedForReceivable } from '../finance/chart-account-flow';
import { prismaDateToDayKey } from '../common/calendar-date.util';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  isRequisicaoKind,
  parseRequisitionTerms,
  requisitionDueDates,
  splitRequisitionAmounts,
  type RequisitionTerms,
} from './requisition.util';

function dec(n: Prisma.Decimal | number | string): number {
  return Number(n);
}

function receivableOpenBalance(amount: Prisma.Decimal, amountPaid: Prisma.Decimal) {
  return Math.max(0, dec(amount) - dec(amountPaid));
}

@Injectable()
export class CommercialRequisitionService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getPartnerRequisitionCredit(user: JwtPayload, partnerId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const partner = await prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner) throw new BadRequestException('Cliente não encontrado');
    const used = await this.openRequisitionExposure(prisma, partnerId);
    return { limit: null, used, available: null };
  }

  /** Requisição fica liberada para o cliente, sem teto de compra. */
  async assertCanUseRequisition(
    _user: JwtPayload,
    _partnerId: string,
    _saleAmount: number,
  ) {
    return { limit: null as number | null, used: 0, available: null as number | null };
  }

  private async openRequisitionExposure(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    partnerId: string,
  ) {
    const rows = await prisma.accountReceivable.findMany({
      where: {
        partnerId,
        approvalStatus: { not: PaymentApprovalStatus.CANCELLED },
        salesOrder: { paymentMethod: 'REQUISICAO' },
      },
      select: { amount: true, amountPaid: true, receivedAt: true },
    });
    let sum = 0;
    for (const r of rows) {
      if (r.receivedAt) continue;
      sum += receivableOpenBalance(r.amount, r.amountPaid);
    }
    return Math.round(sum * 100) / 100;
  }

  async createReceivablesForOrder(user: JwtPayload, salesOrderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({
      where: { id: salesOrderId },
      include: { partner: true, paymentForm: true, secondaryPaymentForm: true },
    });
    if (!order) return null;
    const amount = this.requisitionAmountFromOrder(order);
    if (amount <= 0.004) return null;
    if (!order.requisitionTermsJson) {
      throw new BadRequestException('Venda em requisição sem parcelas definidas.');
    }
    const terms = parseRequisitionTerms(order.requisitionTermsJson);
    await this.assertCanUseRequisition(user, order.partnerId, amount);

    const existing = await prisma.accountReceivable.count({ where: { salesOrderId: order.id } });
    if (existing > 0) return { created: existing };

    const dueDates = requisitionDueDates(terms);
    const amounts = splitRequisitionAmounts(amount, terms.installmentCount);
    const chartAccountId = await this.resolveReceivableChartAccount(prisma);
    const max = await prisma.accountReceivable.aggregate({ _max: { controlNumber: true } });
    let controlNumber = (max._max.controlNumber ?? 0) + 1;

    const created = [];
    for (let i = 0; i < dueDates.length; i++) {
      const row = await prisma.accountReceivable.create({
        data: {
          controlNumber: controlNumber++,
          partnerId: order.partnerId,
          chartAccountId,
          description: [
            `Requisição venda ${order.controlNumber}`,
            dueDates.length > 1 ? `(${i + 1}/${dueDates.length})` : '',
            terms.notes ? `— ${terms.notes}` : '',
          ]
            .filter(Boolean)
            .join(' ')
            .slice(0, 200),
          amount: amounts[i]!,
          dueDate: dueDates[i]!,
          approvalStatus: PaymentApprovalStatus.APPROVED,
          salesOrderId: order.id,
        },
      });
      created.push({
        id: row.id,
        controlNumber: row.controlNumber,
        amount: dec(row.amount),
        dueDate: prismaDateToDayKey(row.dueDate),
      });
    }
    return { created: created.length, items: created };
  }

  async cancelReceivablesForOrder(
    prisma: Prisma.TransactionClient,
    salesOrderId: string,
  ) {
    const rows = await prisma.accountReceivable.findMany({ where: { salesOrderId } });
    for (const r of rows) {
      if (r.receivedAt || dec(r.amountPaid) > 0.005) {
        throw new BadRequestException(
          'Estorne ou baixe as parcelas da requisição antes de anular a venda.',
        );
      }
      await prisma.accountReceivable.update({
        where: { id: r.id },
        data: { approvalStatus: PaymentApprovalStatus.CANCELLED },
      });
    }
  }

  requisitionAmountFromOrder(order: {
    totalAmount: { toString(): string } | number;
    paymentMethod?: string | null;
    paymentForm?: { kind: string } | null;
    secondaryPaymentForm?: { kind: string } | null;
    primaryPaymentAmount?: { toString(): string } | number | null;
    secondaryPaymentFormId?: string | null;
  }) {
    const total = Number(order.totalAmount);
    const primaryKind = (order.paymentForm?.kind || order.paymentMethod || '').toUpperCase();
    const secondaryKind = (order.secondaryPaymentForm?.kind || '').toUpperCase();
    const isPrimary = isRequisicaoKind(primaryKind);
    const isSecondary = isRequisicaoKind(secondaryKind);
    if (order.secondaryPaymentFormId && order.primaryPaymentAmount != null) {
      const primaryAmt = Number(order.primaryPaymentAmount);
      const secondaryAmt = Math.round((total - primaryAmt) * 100) / 100;
      if (isPrimary && isSecondary) return total;
      if (isPrimary) return primaryAmt;
      if (isSecondary) return secondaryAmt;
      return 0;
    }
    return isPrimary ? total : 0;
  }

  termsFromInput(raw: unknown): RequisitionTerms {
    return parseRequisitionTerms(raw);
  }

  private async resolveReceivableChartAccount(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
  ) {
    const accounts = await prisma.chartAccount.findMany({
      where: { isActive: true, isPosting: true },
      orderBy: { code: 'asc' },
    });
    const revenue = accounts.find((a) => chartAccountAllowedForReceivable(a.code, a.type));
    const fallback = accounts[0];
    const chartAccountId = revenue?.id ?? fallback?.id;
    if (!chartAccountId) {
      throw new BadRequestException('Cadastre uma conta contábil de receita para gerar títulos.');
    }
    return chartAccountId;
  }
}
