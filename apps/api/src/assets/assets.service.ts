import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { AssetType, ProjectStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class AssetsService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async listAssets(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.asset.findMany({
      include: { maintenanceLogs: { take: 5, orderBy: { performedAt: 'desc' } } },
    });
  }

  async createAsset(user: JwtPayload, data: { code: string; name: string; type: AssetType }) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.asset.create({ data });
  }

  async addMaintenance(
    user: JwtPayload,
    assetId: string,
    data: { performedAt: string; kind: string; description?: string; cost?: number; chartAccountId?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.maintenanceRecord.create({
      data: {
        assetId,
        performedAt: new Date(data.performedAt),
        kind: data.kind,
        description: data.description,
        cost: data.cost,
        chartAccountId: data.chartAccountId?.trim() || null,
      },
    });
  }

  async listProjects(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.constructionProject.findMany();
  }

  async createProject(
    user: JwtPayload,
    data: { code: string; name: string; budget: number; chartAccountId?: string },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.constructionProject.create({
      data: {
        code: data.code,
        name: data.name,
        budget: data.budget,
        chartAccountId: data.chartAccountId,
        status: ProjectStatus.PLANNING,
      },
    });
  }
}
