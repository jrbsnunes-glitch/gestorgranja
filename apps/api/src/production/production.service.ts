import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { assertBarnAccess, filterLotsByBarnScope } from '../common/barn-scope';
import { AuditService } from '../audit/audit.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EggProductionStockService } from './egg-production-stock.service';
import { UpsertDailyEggDto } from './dto/upsert-daily-egg.dto';
import { UpsertDailyMortalityDto } from './dto/upsert-daily-mortality.dto';

@Injectable()
export class ProductionService {
  private readonly logger = new Logger(ProductionService.name);

  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly eggStock: EggProductionStockService,
  ) {}

  async listLots(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lots = await prisma.flockLot.findMany({
      include: {
        barn: true,
        breedLineage: true,
        mortalities: { select: { quantity: true } },
      },
      orderBy: { housingDate: 'desc' },
    });
    const scoped = await filterLotsByBarnScope(user, lots);
    return scoped.map(({ mortalities, ...lot }) => {
      const mortalityTotal = mortalities.reduce((s, m) => s + m.quantity, 0);
      const liveBirds = Math.max(lot.housedQty - mortalityTotal, 0);
      return { ...lot, mortalityTotal, liveBirds };
    });
  }

  async upsertDailyEgg(user: JwtPayload, dto: UpsertDailyEggDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const date = new Date(dto.date);
    const before = await prisma.dailyEggProduction.findUnique({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
    });

    const row = await prisma.dailyEggProduction.upsert({
      where: { flockLotId_date: { flockLotId: dto.flockLotId, date } },
      create: {
        flockLotId: dto.flockLotId,
        date,
        extra: dto.extra,
        large: dto.large,
        medium: dto.medium,
        small: dto.small,
        cracked: dto.cracked,
        dirty: dto.dirty,
        deformed: dto.deformed,
        discard: dto.discard,
        avgEggWeightG: dto.avgEggWeightG,
        notes: dto.notes,
      },
      update: {
        extra: dto.extra,
        large: dto.large,
        medium: dto.medium,
        small: dto.small,
        cracked: dto.cracked,
        dirty: dto.dirty,
        deformed: dto.deformed,
        discard: dto.discard,
        avgEggWeightG: dto.avgEggWeightG,
        notes: dto.notes,
      },
    });

    void this.audit.log({
      tenantSlug: user.tenantSlug,
      userId: user.sub,
      action: before ? 'UPDATE' : 'CREATE',
      entity: 'DailyEggProduction',
      entityId: row.id,
      before: before ?? undefined,
      after: row,
    });

    void this.eggStock.syncFromProduction(user, row).catch((e) => {
      // não bloqueia postura se estoque não estiver configurado
      this.logger.warn(`Egg stock sync: ${(e as Error).message}`);
    });

    return { row, before };
  }

  async createEnvironmentalReading(
    user: JwtPayload,
    data: { barnId: string; temperatureC?: number; humidityPct?: number; ventilationNote?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    assertBarnAccess(user, data.barnId);
    return prisma.environmentalReading.create({
      data: {
        barnId: data.barnId,
        recordedAt: new Date(),
        temperatureC: data.temperatureC,
        humidityPct: data.humidityPct,
        ventilationNote: data.ventilationNote,
        source: 'MANUAL',
      },
    });
  }

  async createDailyMortality(user: JwtPayload, dto: UpsertDailyMortalityDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const date = new Date(dto.date);
    return prisma.dailyMortality.create({
      data: {
        flockLotId: dto.flockLotId,
        date,
        quantity: dto.quantity,
        cause: dto.cause,
        causeNotes: dto.causeNotes,
      },
    });
  }

  async updateDailyMortality(user: JwtPayload, id: string, dto: UpsertDailyMortalityDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const row = await prisma.dailyMortality.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Registro não encontrado');

    const lot = await prisma.flockLot.findUnique({ where: { id: row.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    if (dto.flockLotId !== row.flockLotId) {
      const target = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
      if (!target) throw new NotFoundException('Lote não encontrado');
      assertBarnAccess(user, target.barnId);
    }

    const date = new Date(dto.date);
    return prisma.dailyMortality.update({
      where: { id },
      data: {
        flockLotId: dto.flockLotId,
        date,
        quantity: dto.quantity,
        cause: dto.cause,
        causeNotes: dto.causeNotes,
      },
    });
  }

  /** Sincronização do campo: um registro por lote/dia (atualiza o mais recente se existir). */
  async upsertDailyMortality(user: JwtPayload, dto: UpsertDailyMortalityDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lot = await prisma.flockLot.findUnique({ where: { id: dto.flockLotId } });
    if (!lot) throw new NotFoundException('Lote não encontrado');
    assertBarnAccess(user, lot.barnId);

    const date = new Date(dto.date);
    const existing = await prisma.dailyMortality.findFirst({
      where: { flockLotId: dto.flockLotId, date },
      orderBy: { updatedAt: 'desc' },
    });

    if (existing) {
      return prisma.dailyMortality.update({
        where: { id: existing.id },
        data: {
          quantity: dto.quantity,
          cause: dto.cause,
          causeNotes: dto.causeNotes,
        },
      });
    }

    return prisma.dailyMortality.create({
      data: {
        flockLotId: dto.flockLotId,
        date,
        quantity: dto.quantity,
        cause: dto.cause,
        causeNotes: dto.causeNotes,
      },
    });
  }

  commercialEggs(row: {
    extra: number;
    large: number;
    medium: number;
    small: number;
  }) {
    return row.extra + row.large + row.medium + row.small;
  }

  async listDailyEggs(user: JwtPayload, flockLotId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lots = await this.listLots(user);
    const lotIds = flockLotId ? [flockLotId] : lots.map((l) => l.id);
    return prisma.dailyEggProduction.findMany({
      where: { flockLotId: { in: lotIds } },
      orderBy: { date: 'desc' },
      take: 500,
      include: { flockLot: { select: { code: true } } },
    });
  }

  async listDailyMortality(user: JwtPayload, flockLotId?: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const lots = await this.listLots(user);
    const lotIds = flockLotId ? [flockLotId] : lots.map((l) => l.id);
    return prisma.dailyMortality.findMany({
      where: { flockLotId: { in: lotIds } },
      orderBy: { date: 'desc' },
      take: 500,
      include: { flockLot: { select: { code: true } } },
    });
  }

  async listEnvironmental(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.environmentalReading.findMany({
      orderBy: { recordedAt: 'desc' },
      take: 500,
      include: { barn: { select: { code: true, name: true } } },
    });
  }
}
