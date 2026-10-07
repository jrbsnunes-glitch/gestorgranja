import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { PaymentApprovalStatus, Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  buildInstallmentsFromTotal,
  daysOverdue,
  dec,
  hasTitlePayment,
  isPayableSettled,
  isReceivableSettled,
  isTitleCancelled,
  parsePaymentTerms,
  titleBalance,
} from './finance-title-utils';
import { RecurringFinanceService } from './recurring-finance.service';

export type TitleSettlementInput = {
  amount?: number;
  settlementDate?: string;
  notes?: string;
  chartAccountId?: string;
};

@Injectable()
export class FinanceService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly recurring: RecurringFinanceService,
  ) {}

  private async nextPayableControl(prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>) {
    const max = await prisma.accountPayable.aggregate({ _max: { controlNumber: true } });
    return (max._max.controlNumber ?? 0) + 1;
  }

  private async nextReceivableControl(prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>) {
    const max = await prisma.accountReceivable.aggregate({ _max: { controlNumber: true } });
    return (max._max.controlNumber ?? 0) + 1;
  }

  async createPayable(
    user: JwtPayload,
    data: {
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: number;
      dueDate: string;
      installments?: number;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const installments = buildInstallmentsFromTotal(
      data.amount,
      data.installments ?? 1,
      data.dueDate,
    );
    let controlNumber = await this.nextPayableControl(prisma);
    const created = [];
    const baseDesc = data.description.trim();
    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      const suffix = installments.length > 1 ? ` (${i + 1}/${installments.length})` : '';
      const row = await prisma.accountPayable.create({
        data: {
          partnerId: data.partnerId,
          chartAccountId: data.chartAccountId,
          description: `${baseDesc}${suffix}`.slice(0, 200),
          amount: inst.amount,
          controlNumber: controlNumber++,
          dueDate: new Date(inst.dueDate + 'T12:00:00'),
          approvalStatus: PaymentApprovalStatus.PENDING,
        },
      });
      created.push(row);
    }
    return installments.length === 1 ? created[0] : { count: created.length, items: created };
  }

  async approvePayable(user: JwtPayload, id: string, approve: boolean) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountPayable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    return prisma.accountPayable.update({
      where: { id },
      data: {
        approvalStatus: approve ? PaymentApprovalStatus.APPROVED : PaymentApprovalStatus.REJECTED,
      },
    });
  }

  async markPayablePaid(user: JwtPayload, id: string, input: TitleSettlementInput = {}) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountPayable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (isTitleCancelled(row.approvalStatus)) throw new BadRequestException('Título cancelado');
    if (row.approvalStatus !== PaymentApprovalStatus.APPROVED && !isPayableSettled(row)) {
      throw new BadRequestException('Pagamento requer aprovação prévia');
    }
    if (isPayableSettled(row)) throw new BadRequestException('Título já liquidado');

    const total = dec(row.amount);
    const paid = dec(row.amountPaid);
    const remaining = total - paid;
    const pay = input.amount != null ? input.amount : remaining;
    if (pay <= 0 || pay > remaining + 0.005) throw new BadRequestException('Valor inválido');

    const newPaid = paid + pay;
    const fullyPaid = newPaid >= total - 0.005;
    const paidAt = input.settlementDate
      ? new Date(input.settlementDate + 'T12:00:00')
      : new Date();

    if (input.chartAccountId) {
      const acc = await prisma.chartAccount.findUnique({ where: { id: input.chartAccountId } });
      if (!acc) throw new BadRequestException('Conta contábil inválida');
    }

    const updated = await prisma.accountPayable.update({
      where: { id },
      data: {
        amountPaid: newPaid,
        paidAt: fullyPaid ? paidAt : row.paidAt,
        approvalStatus: fullyPaid ? PaymentApprovalStatus.PAID : PaymentApprovalStatus.APPROVED,
        settlementNotes: input.notes?.trim() || row.settlementNotes,
        ...(input.chartAccountId ? { chartAccountId: input.chartAccountId } : {}),
      },
    });

    return {
      ...updated,
      remainingBalance: fullyPaid ? 0 : titleBalance(updated.amount, updated.amountPaid),
    };
  }

  async createReceivable(
    user: JwtPayload,
    data: {
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: number;
      dueDate: string;
      installments?: number;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const installments = buildInstallmentsFromTotal(
      data.amount,
      data.installments ?? 1,
      data.dueDate,
    );
    let controlNumber = await this.nextReceivableControl(prisma);
    const created = [];
    const baseDesc = data.description.trim();
    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      const suffix = installments.length > 1 ? ` (${i + 1}/${installments.length})` : '';
      const row = await prisma.accountReceivable.create({
        data: {
          partnerId: data.partnerId,
          chartAccountId: data.chartAccountId,
          description: `${baseDesc}${suffix}`.slice(0, 200),
          amount: inst.amount,
          controlNumber: controlNumber++,
          dueDate: new Date(inst.dueDate + 'T12:00:00'),
          approvalStatus: PaymentApprovalStatus.PENDING,
        },
      });
      created.push(row);
    }
    return installments.length === 1 ? created[0] : { count: created.length, items: created };
  }

  async listOpen(user: JwtPayload) {
    await this.recurring.ensureGenerated(user);
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const [payables, receivables] = await Promise.all([
      prisma.accountPayable.findMany({
        where: {
          approvalStatus: { in: [PaymentApprovalStatus.PENDING, PaymentApprovalStatus.APPROVED] },
        },
        include: { partner: true, chartAccount: true },
      }),
      prisma.accountReceivable.findMany({
        where: {
          approvalStatus: { not: PaymentApprovalStatus.CANCELLED },
          receivedAt: null,
        },
        include: { partner: true, chartAccount: true },
      }),
    ]);
    return { payables, receivables };
  }

  async listReceivablesDetail(user: JwtPayload) {
    await this.recurring.ensureGenerated(user);
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.accountReceivable.findMany({
      include: { partner: true, chartAccount: true },
      orderBy: { dueDate: 'asc' },
    });
    const today = new Date();
    let totalOpen = 0;
    const byPartner = new Map<string, { name: string; open: number; count: number }>();

    const items = rows
      .filter((r) => !isTitleCancelled(r.approvalStatus))
      .map((r) => {
      const settled = isReceivableSettled(r);
      const balance = settled ? 0 : titleBalance(r.amount, r.amountPaid);
      const overdueDays = settled ? 0 : daysOverdue(r.dueDate, today);
      if (!settled) {
        totalOpen += balance;
        const cur = byPartner.get(r.partnerId) ?? { name: r.partner.name, open: 0, count: 0 };
        cur.open += balance;
        cur.count += 1;
        byPartner.set(r.partnerId, cur);
      }
      return {
        ...r,
        balance,
        overdueDays,
        settled,
      };
    });

    const concentration = [...byPartner.entries()]
      .map(([partnerId, v]) => ({
        partnerId,
        partnerName: v.name,
        openBalance: v.open,
        titleCount: v.count,
        sharePct: totalOpen > 0 ? (v.open / totalOpen) * 100 : 0,
      }))
      .sort((a, b) => b.openBalance - a.openBalance)
      .slice(0, 5);

    return { items, concentration, totalOpen };
  }

  async receiveReceivable(user: JwtPayload, id: string, input: TitleSettlementInput = {}) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (isTitleCancelled(row.approvalStatus)) throw new BadRequestException('Título cancelado');
    if (isReceivableSettled(row)) throw new BadRequestException('Título já liquidado');

    const total = dec(row.amount);
    const paid = dec(row.amountPaid);
    const remaining = total - paid;
    const pay = input.amount != null ? input.amount : remaining;
    if (pay <= 0 || pay > remaining + 0.005) throw new BadRequestException('Valor inválido');

    const newPaid = paid + pay;
    const fullyPaid = newPaid >= total - 0.005;
    const receivedAt = input.settlementDate
      ? new Date(input.settlementDate + 'T12:00:00')
      : new Date();

    if (input.chartAccountId) {
      const acc = await prisma.chartAccount.findUnique({ where: { id: input.chartAccountId } });
      if (!acc) throw new BadRequestException('Conta contábil inválida');
    }

    const updated = await prisma.accountReceivable.update({
      where: { id },
      data: {
        amountPaid: newPaid,
        receivedAt: fullyPaid ? receivedAt : row.receivedAt,
        approvalStatus: fullyPaid ? PaymentApprovalStatus.PAID : row.approvalStatus,
        settlementNotes: input.notes?.trim() || row.settlementNotes,
        ...(input.chartAccountId ? { chartAccountId: input.chartAccountId } : {}),
      },
    });

    return {
      ...updated,
      remainingBalance: fullyPaid ? 0 : titleBalance(updated.amount, updated.amountPaid),
    };
  }

  async generatePayablesFromOrder(
    user: JwtPayload,
    orderId: string,
    data: { partnerId: string; chartAccountId: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.purchaseOrder.findUnique({
      where: { id: orderId },
      include: { purchaseRequest: true },
    });
    if (!order) throw new NotFoundException('Pedido não encontrado');
    if (order.payablesGenerated) throw new BadRequestException('Contas a pagar já geradas para este pedido');

    const terms = parsePaymentTerms(order.paymentTermsJson);
    if (!terms.length) throw new BadRequestException('Defina parcelas de pagamento no pedido');

    const created = [];
    for (const t of terms) {
      const controlNumber = await this.nextPayableControl(prisma);
      const row = await prisma.accountPayable.create({
        data: {
          controlNumber,
          partnerId: data.partnerId,
          chartAccountId: data.chartAccountId,
          description: `Compra ${order.orderNumber} — ${order.purchaseRequest.description}`.slice(0, 200),
          amount: t.amount,
          dueDate: new Date(t.dueDate + 'T12:00:00'),
          approvalStatus: PaymentApprovalStatus.PENDING,
        },
      });
      created.push(row);
    }
    await prisma.purchaseOrder.update({
      where: { id: orderId },
      data: { payablesGenerated: true, financeApprovedAt: new Date(), financeApprovedByUserId: user.sub },
    });
    return created;
  }

  private assertPayableEditable(row: {
    amount: Prisma.Decimal;
    approvalStatus: PaymentApprovalStatus;
    amountPaid: Prisma.Decimal;
    paidAt?: Date | null;
  }) {
    if (isTitleCancelled(row.approvalStatus)) {
      throw new BadRequestException('Título cancelado');
    }
    if (hasTitlePayment(row.amountPaid) || row.paidAt || isPayableSettled(row)) {
      throw new BadRequestException(
        'Estorne o pagamento antes de alterar o registro da conta a pagar',
      );
    }
  }

  private assertReceivableEditable(row: {
    amount: Prisma.Decimal;
    approvalStatus: PaymentApprovalStatus;
    amountPaid: Prisma.Decimal;
    receivedAt?: Date | null;
  }) {
    if (isTitleCancelled(row.approvalStatus)) {
      throw new BadRequestException('Título cancelado');
    }
    if (hasTitlePayment(row.amountPaid) || row.receivedAt || isReceivableSettled(row)) {
      throw new BadRequestException(
        'Estorne o recebimento antes de alterar o registro da conta a receber',
      );
    }
  }

  async updatePayable(
    user: JwtPayload,
    id: string,
    data: {
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: number;
      dueDate: string;
    },
  ) {
    if (data.amount <= 0) throw new BadRequestException('Valor inválido');
    const desc = data.description.trim();
    if (!desc) throw new BadRequestException('Descrição obrigatória');
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountPayable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    this.assertPayableEditable(row);

    const partner = await prisma.partner.findUnique({ where: { id: data.partnerId } });
    if (!partner) throw new BadRequestException('Parceiro inválido');
    const chartAccount = await prisma.chartAccount.findUnique({ where: { id: data.chartAccountId } });
    if (!chartAccount) throw new BadRequestException('Conta contábil inválida');

    return prisma.accountPayable.update({
      where: { id },
      data: {
        partnerId: data.partnerId,
        chartAccountId: data.chartAccountId,
        description: desc.slice(0, 200),
        amount: data.amount,
        dueDate: new Date(data.dueDate + 'T12:00:00'),
      },
      include: { partner: true, chartAccount: true },
    });
  }

  async updateReceivable(
    user: JwtPayload,
    id: string,
    data: {
      partnerId: string;
      chartAccountId: string;
      description: string;
      amount: number;
      dueDate: string;
    },
  ) {
    if (data.amount <= 0) throw new BadRequestException('Valor inválido');
    const desc = data.description.trim();
    if (!desc) throw new BadRequestException('Descrição obrigatória');
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    this.assertReceivableEditable(row);

    const partner = await prisma.partner.findUnique({ where: { id: data.partnerId } });
    if (!partner) throw new BadRequestException('Parceiro inválido');
    const chartAccount = await prisma.chartAccount.findUnique({ where: { id: data.chartAccountId } });
    if (!chartAccount) throw new BadRequestException('Conta contábil inválida');

    return prisma.accountReceivable.update({
      where: { id },
      data: {
        partnerId: data.partnerId,
        chartAccountId: data.chartAccountId,
        description: desc.slice(0, 200),
        amount: data.amount,
        dueDate: new Date(data.dueDate + 'T12:00:00'),
      },
      include: { partner: true, chartAccount: true },
    });
  }

  async voidPayablePayment(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountPayable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (isTitleCancelled(row.approvalStatus)) {
      throw new BadRequestException('Título cancelado');
    }
    if (!hasTitlePayment(row.amountPaid) && !row.paidAt) {
      throw new BadRequestException('Não há pagamento informado neste título');
    }
    const statusAfter =
      row.approvalStatus === PaymentApprovalStatus.PAID
        ? PaymentApprovalStatus.APPROVED
        : row.approvalStatus;
    return prisma.accountPayable.update({
      where: { id },
      data: {
        amountPaid: 0,
        paidAt: null,
        approvalStatus: statusAfter,
        settlementNotes: null,
      },
      include: { partner: true, chartAccount: true },
    });
  }

  async cancelPayable(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountPayable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (isTitleCancelled(row.approvalStatus)) {
      throw new BadRequestException('Título já cancelado');
    }
    if (hasTitlePayment(row.amountPaid) || row.paidAt) {
      throw new BadRequestException(
        'Estorne o pagamento antes de cancelar o registro da conta a pagar',
      );
    }
    if (row.approvalStatus === PaymentApprovalStatus.PAID) {
      throw new BadRequestException('Estorne o pagamento antes de cancelar o registro');
    }
    return prisma.accountPayable.update({
      where: { id },
      data: { approvalStatus: PaymentApprovalStatus.CANCELLED },
      include: { partner: true, chartAccount: true },
    });
  }

  async voidReceivablePayment(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (isTitleCancelled(row.approvalStatus)) {
      throw new BadRequestException('Título cancelado');
    }
    if (!hasTitlePayment(row.amountPaid) && !row.receivedAt) {
      throw new BadRequestException('Não há recebimento informado neste título');
    }
    const statusAfter =
      row.approvalStatus === PaymentApprovalStatus.PAID
        ? PaymentApprovalStatus.APPROVED
        : row.approvalStatus;
    return prisma.accountReceivable.update({
      where: { id },
      data: {
        amountPaid: 0,
        receivedAt: null,
        approvalStatus: statusAfter,
        settlementNotes: null,
      },
      include: { partner: true, chartAccount: true },
    });
  }

  async cancelReceivable(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.accountReceivable.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (isTitleCancelled(row.approvalStatus)) {
      throw new BadRequestException('Título já cancelado');
    }
    if (hasTitlePayment(row.amountPaid) || row.receivedAt) {
      throw new BadRequestException(
        'Estorne o recebimento antes de cancelar o registro da conta a receber',
      );
    }
    if (isReceivableSettled(row)) {
      throw new BadRequestException('Estorne o recebimento antes de cancelar o registro');
    }
    return prisma.accountReceivable.update({
      where: { id },
      data: { approvalStatus: PaymentApprovalStatus.CANCELLED },
      include: { partner: true, chartAccount: true },
    });
  }
}
