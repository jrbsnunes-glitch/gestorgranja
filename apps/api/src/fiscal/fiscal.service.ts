import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { FiscalDocumentStatus, SefazEnvironment } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

/**
 * Emissão SEFAZ completa: portar processors do GestorVend (FiscalIssuerSettings + fila Bull).
 * MVP Fase 2: persistência de documento e fila simulada.
 */
@Injectable()
export class FiscalService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async getIssuerSettings(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst({ include: { fiscalIssuerSettings: true } });
    if (!company) throw new NotFoundException('Empresa não cadastrada');
    return company.fiscalIssuerSettings;
  }

  async updateIssuerSettings(
    user: JwtPayload,
    data: {
      sefazEnvironment?: SefazEnvironment;
      certificatePath?: string;
      certificatePassword?: string;
      nfceCscId?: string;
      nfceCsc?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const company = await prisma.company.findFirst();
    if (!company) throw new NotFoundException('Empresa não cadastrada');
    return prisma.fiscalIssuerSettings.upsert({
      where: { companyId: company.id },
      create: { companyId: company.id, ...data },
      update: data,
    });
  }

  async queueEmission(user: JwtPayload, salesOrderId: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const order = await prisma.salesOrder.findUnique({ where: { id: salesOrderId } });
    if (!order) throw new NotFoundException('Pedido não encontrado');

    return prisma.fiscalDocument.create({
      data: {
        salesOrderId,
        type: 'NFE',
        status: FiscalDocumentStatus.PROCESSING,
      },
    });
  }
}
