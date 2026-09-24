import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { NutritionService } from '../nutrition/nutrition.service';
import { ProductionService } from '../production/production.service';
import { formatSyncConflictMessage } from '../common/humanize-user-message.util';
import { SyncBatchDto } from './dto/sync-batch.dto';

@Injectable()
export class SyncService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly production: ProductionService,
    private readonly nutrition: NutritionService,
  ) {}

  async processBatch(user: JwtPayload, dto: SyncBatchDto) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const results: unknown[] = [];

    for (const op of dto.operations) {
      const existing = await prisma.processedSyncOperation.findUnique({
        where: { operationId: op.operationId },
      });
      if (existing) {
        results.push({ operationId: op.operationId, status: 'duplicate' });
        continue;
      }

      try {
        let result: unknown;
        if (op.type === 'dailyEggProduction') {
          result = await this.production
            .upsertDailyEgg(user, op.payload as unknown as Parameters<ProductionService['upsertDailyEgg']>[1])
            .then((r) => r.row);
        } else if (op.type === 'dailyMortality') {
          result = await this.production.upsertDailyMortality(
            user,
            op.payload as unknown as Parameters<ProductionService['upsertDailyMortality']>[1],
          );
        } else if (op.type === 'dailyFeedConsumption') {
          result = await this.nutrition.upsertFeed(
            user,
            op.payload as unknown as Parameters<NutritionService['upsertFeed']>[1],
          );
        } else {
          results.push({ operationId: op.operationId, status: 'unsupported' });
          continue;
        }

        try {
          await prisma.processedSyncOperation.create({
            data: { operationId: op.operationId, type: op.type },
          });
        } catch (createErr) {
          if (
            createErr instanceof Prisma.PrismaClientKnownRequestError &&
            createErr.code === 'P2002'
          ) {
            results.push({ operationId: op.operationId, status: 'duplicate', result });
            continue;
          }
          throw createErr;
        }
        results.push({ operationId: op.operationId, status: 'ok', result });
      } catch (err) {
        await prisma.syncConflict.create({
          data: {
            operationId: op.operationId,
            entityType: op.type,
            clientPayload: op.payload as Prisma.InputJsonValue,
            serverPayload: { error: err instanceof Error ? err.message : String(err) } as Prisma.InputJsonValue,
          },
        });
        await prisma.alert.create({
          data: {
            type: 'SYNC_CONFLICT',
            title: 'Conflito de sincronização',
            message: formatSyncConflictMessage(op.type, op.payload, err),
            referenceId: op.operationId,
          },
        });
        results.push({ operationId: op.operationId, status: 'conflict' });
      }
    }

    return { results };
  }

  async listConflicts(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.syncConflict.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
    });
  }
}
