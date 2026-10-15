import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import {
  daysOverdue,
  isReceivableSettled,
  isTitleCancelled,
  titleBalance,
} from '../finance/finance-title-utils';

export type CollectionReportTitleRow = {
  receivableControlNumber: number;
  salesControlNumber: number | null;
  saleDate: string | null;
  dueDate: string;
  balance: number;
  situation: 'overdue' | 'due';
};

export type CollectionReportClientRow = {
  partnerId: string;
  name: string;
  partnerControlNumber: number;
  document: string | null;
  phone: string | null;
  totalOpen: number;
  titles: CollectionReportTitleRow[];
};

export type CollectionReportPayload = {
  partnerCount: number;
  grandTotalOpen: number;
  clients: CollectionReportClientRow[];
};

@Injectable()
export class CollectionReportService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async report(user: JwtPayload, partnerIds: string[]): Promise<CollectionReportPayload> {
    const ids = [...new Set(partnerIds.map((id) => id.trim()).filter(Boolean))];
    if (ids.length === 0) {
      throw new BadRequestException('Informe ao menos um cliente (partnerIds).');
    }

    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const today = new Date();
    const rows = await prisma.accountReceivable.findMany({
      where: { partnerId: { in: ids } },
      include: {
        partner: true,
        salesOrder: { select: { controlNumber: true, orderDate: true } },
      },
      orderBy: [{ partnerId: 'asc' }, { dueDate: 'asc' }],
    });

    const byPartner = new Map<string, CollectionReportClientRow>();

    for (const r of rows) {
      if (isTitleCancelled(r.approvalStatus)) continue;
      if (isReceivableSettled(r)) continue;
      const balance = titleBalance(r.amount, r.amountPaid);
      if (balance <= 0.004) continue;

      const overdue = daysOverdue(r.dueDate, today) > 0;
      const p = r.partner;
      const doc = p.cnpj?.trim() || p.cpf?.trim() || p.document?.trim() || null;
      const phone = p.mobile?.trim() || p.phone?.trim() || null;

      let client = byPartner.get(r.partnerId);
      if (!client) {
        client = {
          partnerId: r.partnerId,
          name: p.name,
          partnerControlNumber: p.controlNumber,
          document: doc,
          phone,
          totalOpen: 0,
          titles: [],
        };
        byPartner.set(r.partnerId, client);
      }

      client.totalOpen += balance;
      client.titles.push({
        receivableControlNumber: r.controlNumber,
        salesControlNumber: r.salesOrder?.controlNumber ?? null,
        saleDate: r.salesOrder?.orderDate ? r.salesOrder.orderDate.toISOString() : null,
        dueDate: r.dueDate.toISOString(),
        balance,
        situation: overdue ? 'overdue' : 'due',
      });
    }

    const clients = ids
      .map((id) => byPartner.get(id))
      .filter((c): c is CollectionReportClientRow => c != null && c.titles.length > 0);

    const grandTotalOpen = clients.reduce((s, c) => s + c.totalOpen, 0);

    return {
      partnerCount: clients.length,
      grandTotalOpen: Math.round(grandTotalOpen * 100) / 100,
      clients: clients.map((c) => ({
        ...c,
        totalOpen: Math.round(c.totalOpen * 100) / 100,
        titles: c.titles.map((t) => ({ ...t, balance: Math.round(t.balance * 100) / 100 })),
      })),
    };
  }
}
