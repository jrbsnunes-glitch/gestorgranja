import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { CreateHealthEventDto } from './dto/create-health-event.dto';

@Injectable()
export class SanidadeService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async createHealthEvent(user: JwtPayload, dto: CreateHealthEventDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const appliedAt = new Date(dto.appliedAt);
    const withdrawalUntil = new Date(appliedAt);
    withdrawalUntil.setDate(withdrawalUntil.getDate() + dto.withdrawalDays);
    let productName = dto.productName ?? 'Produto';
    let brand: string | undefined;
    let doseMl: number | undefined;
    let withdrawalDays = dto.withdrawalDays;
    if (dto.sanitaryProductId) {
      const sp = await prisma.sanitaryProduct.findUnique({ where: { id: dto.sanitaryProductId } });
      if (sp) {
        productName = sp.name;
        brand = sp.brand ?? undefined;
        doseMl = sp.doseMl ? Number(sp.doseMl) : undefined;
        if (!dto.withdrawalDays) withdrawalDays = sp.withdrawalDaysDefault;
      }
    }
    const until = new Date(appliedAt);
    until.setDate(until.getDate() + withdrawalDays);
    return prisma.healthEvent.create({
      data: {
        flockLotId: dto.flockLotId,
        type: dto.type,
        sanitaryProductId: dto.sanitaryProductId,
        productName,
        brand,
        doseMl,
        appliedAt,
        withdrawalDays,
        withdrawalUntil: until,
        notes: dto.notes,
      },
    });
  }

  searchSanitaryProducts(user: JwtPayload, q: string) {
    return this.tenantPrisma.getClient(user.tenantSlug).then((p) =>
      p.sanitaryProduct.findMany({
        where: q ? { name: { contains: q, mode: 'insensitive' }, isActive: true } : { isActive: true },
        take: 30,
        orderBy: { name: 'asc' },
      }),
    );
  }

  createSanitaryProduct(user: JwtPayload, data: Record<string, unknown>) {
    return this.tenantPrisma.getClient(user.tenantSlug).then((p) =>
      p.sanitaryProduct.create({
        data: {
          name: String(data.name),
          brand: data.brand ? String(data.brand) : undefined,
          activeIngredient: data.activeIngredient ? String(data.activeIngredient) : undefined,
          doseMl: data.doseMl !== undefined ? Number(data.doseMl) : undefined,
          withdrawalDaysDefault: Number(data.withdrawalDaysDefault ?? 0),
        },
      }),
    );
  }

  async listBiosecurity(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.biosecurityLog.findMany({ orderBy: { visitedAt: 'desc' }, take: 100 });
  }

  async createBiosecurity(
    user: JwtPayload,
    data: {
      visitedAt: string;
      visitorName: string;
      vehiclePlate?: string;
      purpose?: string;
      epiUsed?: boolean;
      notes?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.biosecurityLog.create({
      data: {
        visitedAt: new Date(data.visitedAt),
        visitorName: data.visitorName,
        vehiclePlate: data.vehiclePlate,
        purpose: data.purpose,
        epiUsed: data.epiUsed ?? true,
        notes: data.notes,
      },
    });
  }

  async listHealthEvents(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.healthEvent.findMany({
      orderBy: { appliedAt: 'desc' },
      take: 100,
      include: { flockLot: { select: { code: true } } },
    });
  }
}
