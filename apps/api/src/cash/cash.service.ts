import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashMovementType, CashSessionStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class CashService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  private db(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  async openSession(user: JwtPayload, openingBalance: number) {
    const prisma = await this.db(user);
    const open = await prisma.cashRegisterSession.findFirst({
      where: { userId: user.sub, status: CashSessionStatus.OPEN },
    });
    if (open) throw new BadRequestException('Já existe caixa aberto');
    return prisma.cashRegisterSession.create({
      data: { userId: user.sub, openingBalance },
    });
  }

  private sessionWithMovementsInclude() {
    return {
      movements: {
        orderBy: { createdAt: 'desc' as const },
        include: { chartAccount: { select: { code: true, name: true } } },
      },
      user: { select: { name: true, username: true } },
    };
  }

  async myOpenSession(user: JwtPayload) {
    const prisma = await this.db(user);
    return prisma.cashRegisterSession.findFirst({
      where: { userId: user.sub, status: CashSessionStatus.OPEN },
      orderBy: { openedAt: 'asc' },
      include: this.sessionWithMovementsInclude(),
    });
  }

  async listOpenSessions(user: JwtPayload) {
    const prisma = await this.db(user);
    const rows = await prisma.cashRegisterSession.findMany({
      where: { status: CashSessionStatus.OPEN },
      orderBy: { openedAt: 'asc' },
      include: { user: { select: { name: true, username: true } } },
    });
    return rows.map((s) => ({
      id: s.id,
      controlNumber: s.controlNumber,
      openedAt: s.openedAt,
      openingBalance: s.openingBalance,
      status: s.status,
      user: s.user,
      isMine: s.userId === user.sub,
    }));
  }

  async getSession(user: JwtPayload, sessionId: string) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: this.sessionWithMovementsInclude(),
    });
    if (!session) throw new NotFoundException();
    if (session.userId !== user.sub) {
      throw new BadRequestException('Somente o operador da sessão pode abrir o detalhe para lançamentos.');
    }
    if (session.status !== CashSessionStatus.OPEN) {
      throw new BadRequestException('Esta sessão não está aberta.');
    }
    return session;
  }

  listSessions(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.cashRegisterSession.findMany({
        orderBy: { openedAt: 'desc' },
        take: 100,
        include: {
          user: { select: { name: true, username: true } },
          movements: { include: { chartAccount: { select: { code: true, name: true } } } },
        },
      }),
    );
  }

  async addMovement(
    user: JwtPayload,
    sessionId: string,
    data: {
      type: 'IN' | 'OUT';
      amount: number;
      reason?: string;
      paymentMethod?: string;
      chartAccountId?: string;
      isExpense?: boolean;
    },
  ) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new BadRequestException('Sessão não encontrada');
    if (
      session.status !== CashSessionStatus.OPEN &&
      session.status !== CashSessionStatus.PENDING_RECONCILIATION
    ) {
      throw new BadRequestException('Só é possível lançar com caixa aberto ou em conferência.');
    }
    const isExpense = Boolean(data.isExpense);
    if (isExpense && data.type !== 'OUT') {
      throw new BadRequestException('Despesa deve ser registrada como saída');
    }
    if (data.chartAccountId?.trim()) {
      const acc = await prisma.chartAccount.findFirst({
        where: { id: data.chartAccountId.trim(), isActive: true },
      });
      if (!acc) throw new BadRequestException('Conta contábil inválida');
    }
    return prisma.cashMovement.create({
      data: {
        sessionId,
        type: data.type as CashMovementType,
        isExpense,
        amount: data.amount,
        reason: data.reason,
        paymentMethod: data.paymentMethod,
        chartAccountId: data.chartAccountId?.trim() || null,
      },
      include: { chartAccount: { select: { code: true, name: true } } },
    });
  }

  async updateMovement(
    user: JwtPayload,
    sessionId: string,
    movementId: string,
    data: {
      type?: 'IN' | 'OUT';
      amount?: number;
      reason?: string;
      paymentMethod?: string;
      chartAccountId?: string | null;
      isExpense?: boolean;
    },
  ) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== CashSessionStatus.PENDING_RECONCILIATION) {
      throw new BadRequestException('Ajustes só são permitidos durante a conferência.');
    }
    const existing = await prisma.cashMovement.findFirst({
      where: { id: movementId, sessionId },
    });
    if (!existing) throw new NotFoundException();
    const type = (data.type ?? existing.type) as CashMovementType;
    const isExpense = data.isExpense !== undefined ? Boolean(data.isExpense) : existing.isExpense;
    if (isExpense && type !== CashMovementType.OUT) {
      throw new BadRequestException('Despesa deve ser registrada como saída');
    }
    const chartAccountId =
      data.chartAccountId !== undefined
        ? data.chartAccountId?.trim() || null
        : existing.chartAccountId;
    if (chartAccountId) {
      const acc = await prisma.chartAccount.findFirst({ where: { id: chartAccountId, isActive: true } });
      if (!acc) throw new BadRequestException('Conta contábil inválida');
    }
    return prisma.cashMovement.update({
      where: { id: movementId },
      data: {
        ...(data.type !== undefined ? { type: type as CashMovementType } : {}),
        ...(data.amount !== undefined ? { amount: data.amount } : {}),
        ...(data.reason !== undefined ? { reason: data.reason || null } : {}),
        ...(data.paymentMethod !== undefined ? { paymentMethod: data.paymentMethod || null } : {}),
        isExpense,
        chartAccountId,
      },
      include: { chartAccount: { select: { code: true, name: true } } },
    });
  }

  async deleteMovement(user: JwtPayload, sessionId: string, movementId: string) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session || session.status !== CashSessionStatus.PENDING_RECONCILIATION) {
      throw new BadRequestException('Ajustes só são permitidos durante a conferência.');
    }
    const existing = await prisma.cashMovement.findFirst({
      where: { id: movementId, sessionId },
    });
    if (!existing) throw new NotFoundException();
    await prisma.cashMovement.delete({ where: { id: movementId } });
    return { ok: true };
  }

  async requestClose(user: JwtPayload, sessionId: string, closingBalance: number, closingNotes?: string) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.sub) throw new NotFoundException();
    if (session.status !== CashSessionStatus.OPEN) throw new BadRequestException('Caixa não está aberto');
    return prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: CashSessionStatus.PENDING_RECONCILIATION,
        closingBalance,
        closingNotes,
        closedAt: new Date(),
      },
    });
  }

  listPendingReconciliation(user: JwtPayload) {
    return this.db(user).then((p) =>
      p.cashRegisterSession.findMany({
        where: { status: CashSessionStatus.PENDING_RECONCILIATION },
        include: {
          user: { select: { name: true, username: true } },
          movements: { include: { chartAccount: { select: { code: true, name: true } } } },
        },
        orderBy: { closedAt: 'desc' },
      }),
    );
  }

  async getSessionReconciliation(user: JwtPayload, sessionId: string) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({
      where: { id: sessionId },
      include: this.sessionWithMovementsInclude(),
    });
    if (!session) throw new NotFoundException();
    if (session.status !== CashSessionStatus.PENDING_RECONCILIATION) {
      throw new BadRequestException('Sessão não está aguardando conciliação.');
    }
    return session;
  }

  async reconcile(user: JwtPayload, sessionId: string, notes?: string) {
    const prisma = await this.db(user);
    const session = await prisma.cashRegisterSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException();
    if (session.status !== CashSessionStatus.PENDING_RECONCILIATION) {
      throw new BadRequestException('Sessão não está aguardando conciliação.');
    }
    return prisma.cashRegisterSession.update({
      where: { id: sessionId },
      data: {
        status: CashSessionStatus.RECONCILED,
        reconciledAt: new Date(),
        reconciledByUserId: user.sub,
        reconciliationNotes: notes,
      },
    });
  }
}
