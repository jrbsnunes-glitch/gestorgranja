import { Injectable, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess } from '../common/barn-scope';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { UpsertFeedDto } from './dto/upsert-feed.dto';

@Injectable()
export class NutritionService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async upsertFeed(user: JwtPayload, dto: UpsertFeedDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);
    const date = new Date(dto.date);
    return prisma.dailyFeedConsumption.upsert({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
      create: {
        flockLotId: dto.flockLotId,
        date,
        consumedKg: dto.consumedKg,
        leftoverKg: dto.leftoverKg ?? 0,
      },
      update: {
        consumedKg: dto.consumedKg,
        leftoverKg: dto.leftoverKg ?? 0,
      },
    });
  }

  async transferFeed(
    user: JwtPayload,
    data: { fromLotId: string; toLotId: string; date: string; quantityKg: number; notes?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const from = await prisma.flockLot.findUnique({ where: { id: data.fromLotId } });
    const to = await prisma.flockLot.findUnique({ where: { id: data.toLotId } });
    if (!from || !to) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, from.barnId);
    assertBarnAccess(user, to.barnId);
    return prisma.feedTransfer.create({
      data: {
        fromLotId: data.fromLotId,
        toLotId: data.toLotId,
        date: new Date(data.date),
        quantityKg: data.quantityKg,
        notes: data.notes,
      },
    });
  }

  async listDailyFeed(user: JwtPayload, flockLotId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.dailyFeedConsumption.findMany({
      where: flockLotId ? { flockLotId } : undefined,
      orderBy: { date: 'desc' },
      take: 500,
      include: { flockLot: { select: { code: true } } },
    });
  }

  async listFeedTransfers(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.feedTransfer.findMany({
      orderBy: { date: 'desc' },
      take: 500,
      include: {
        fromLot: { select: { code: true } },
        toLot: { select: { code: true } },
      },
    });
  }
}
