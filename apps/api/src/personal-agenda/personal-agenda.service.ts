import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { prismaDateOnly } from '../common/calendar-date.util';
import { PersonalBillStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

const CATEGORIES = new Set([
  'LUZ',
  'FACULDADE',
  'CARRO',
  'CARTAO',
  'INTERNET',
  'TELEFONE',
  'SEGURO',
  'OUTROS',
]);

export type CreatePersonalBillInput = {
  description: string;
  amount: number;
  dueDate: string;
  installments?: number;
  category?: string;
};

function normalizeCategory(raw: string | undefined): string {
  const value = (raw ?? 'OUTROS').trim().toUpperCase();
  if (!CATEGORIES.has(value)) throw new BadRequestException('Tipo de conta inválido.');
  return value;
}

@Injectable()
export class PersonalAgendaService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const items = await prisma.personalBill.findMany({
      where: { userId: user.sub },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    });
    return { items };
  }

  async create(user: JwtPayload, input: CreatePersonalBillInput) {
    const description = input.description?.trim();
    if (!description) throw new BadRequestException('Informe a descrição.');
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Valor inválido.');
    const due = String(input.dueDate ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new BadRequestException('Vencimento inválido.');
    const count = Math.min(60, Math.max(1, Math.floor(Number(input.installments) || 1)));
    const category = normalizeCategory(input.category);

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const created = [];
    for (let i = 0; i < count; i++) {
      const dueDate = addMonths(due, i);
      created.push(
        await prisma.personalBill.create({
          data: {
            userId: user.sub,
            description,
            category,
            amount,
            dueDate: prismaDateOnly(dueDate),
            installmentIndex: count > 1 ? i + 1 : null,
            installmentCount: count > 1 ? count : null,
          },
        }),
      );
    }
    return { items: created };
  }

  async update(
    user: JwtPayload,
    id: string,
    input: { description?: string; amount?: number; dueDate?: string; category?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await this.ownedOpen(prisma, user.sub, id);
    const data: { description?: string; amount?: number; dueDate?: Date; category?: string } = {};
    if (input.description != null) {
      const description = input.description.trim();
      if (!description) throw new BadRequestException('Informe a descrição.');
      data.description = description;
    }
    if (input.amount != null) {
      const amount = Number(input.amount);
      if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Valor inválido.');
      data.amount = amount;
    }
    if (input.dueDate != null) {
      const due = String(input.dueDate).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new BadRequestException('Vencimento inválido.');
      data.dueDate = prismaDateOnly(due);
    }
    if (input.category != null) {
      data.category = normalizeCategory(input.category);
    }
    return prisma.personalBill.update({ where: { id: row.id }, data });
  }

  async pay(
    user: JwtPayload,
    id: string,
    input: { amount?: number; settlementDate?: string; notes?: string; paymentLabel?: string } = {},
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await this.ownedOpen(prisma, user.sub, id);
    const total = Number(row.amount);
    const already = Number(row.amountPaid);
    const remaining = Math.round((total - already) * 100) / 100;
    const amount = input.amount == null ? remaining : Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Informe o valor do pagamento.');
    if (amount - remaining > 0.009) {
      throw new BadRequestException('O valor não pode ser maior que o saldo em aberto.');
    }
    const nextPaid = Math.round((already + amount) * 100) / 100;
    const settled = nextPaid + 0.004 >= total;
    let paidAt = new Date();
    if (input.settlementDate) {
      const day = String(input.settlementDate).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new BadRequestException('Data do pagamento inválida.');
      paidAt = prismaDateOnly(day);
    }
    const notes = input.notes?.trim() || null;
    const paymentLabel = input.paymentLabel?.trim() || null;
    return prisma.personalBill.update({
      where: { id: row.id },
      data: {
        amountPaid: nextPaid,
        status: settled ? PersonalBillStatus.PAID : PersonalBillStatus.OPEN,
        paidAt: settled ? paidAt : row.paidAt,
        settlementNotes: notes ?? row.settlementNotes,
        paymentLabel: paymentLabel ?? row.paymentLabel,
      },
    });
  }

  async remove(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.personalBill.findFirst({ where: { id, userId: user.sub } });
    if (!row) throw new NotFoundException('Conta pessoal não encontrada.');
    await prisma.personalBill.delete({ where: { id: row.id } });
    return { ok: true };
  }

  private async ownedOpen(
    prisma: Awaited<ReturnType<TenantPrismaService['getClient']>>,
    userId: string,
    id: string,
  ) {
    const row = await prisma.personalBill.findFirst({ where: { id, userId } });
    if (!row) throw new NotFoundException('Conta pessoal não encontrada.');
    if (row.status === PersonalBillStatus.PAID) {
      throw new BadRequestException('Conta já paga. Não altera o caixa da granja.');
    }
    return row;
  }
}

function addMonths(dayKey: string, months: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + months, 1));
  const last = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d, last);
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${dt.getUTCFullYear()}-${mm}-${dd}`;
}
