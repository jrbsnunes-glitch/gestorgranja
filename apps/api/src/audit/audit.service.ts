import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async listLogs(tenantSlug: string, opts: { entity?: string; limit?: number }) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    return prisma.auditLog.findMany({
      where: opts.entity ? { entity: opts.entity } : undefined,
      orderBy: { createdAt: 'desc' },
      take: Math.min(opts.limit ?? 100, 500),
      include: { user: { select: { username: true, name: true } } },
    });
  }

  async log(params: {
    tenantSlug: string;
    userId?: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: unknown;
    after?: unknown;
    /** Justificativa da alteração/ajuste (quando informada). */
    reason?: string;
    ip?: string;
  }) {
    const prisma = await this.tenantPrisma.getClient(params.tenantSlug);
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        beforeJson: params.before as Prisma.InputJsonValue | undefined,
        afterJson: params.after as Prisma.InputJsonValue | undefined,
        reason: params.reason?.trim() || undefined,
        ip: params.ip,
      },
    });
  }

  /** Histórico de alterações de um registro específico (mais recente primeiro). */
  async historyFor(tenantSlug: string, entity: string, entityId: string, limit = 50) {
    const prisma = await this.tenantPrisma.getClient(tenantSlug);
    return prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
      include: { user: { select: { username: true, name: true } } },
    });
  }
}
