import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class BankAccountService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  list(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug).then((p) =>
      p.bankAccount.findMany({ include: { bank: true }, orderBy: { bankName: 'asc' } }),
    );
  }

  async create(
    user: JwtPayload,
    data: { bankName: string; agency: string; account: string; balance?: number; bankId?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.bankAccount.create({
      data: {
        bankName: data.bankName,
        agency: data.agency,
        account: data.account,
        balance: data.balance ?? 0,
        bankId: data.bankId,
      },
    });
  }

  async updateBalance(user: JwtPayload, id: string, balance: number) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.bankAccount.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Conta bancária não encontrada');
    return prisma.bankAccount.update({ where: { id }, data: { balance } });
  }
}
