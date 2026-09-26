import { Injectable } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';
import { AlertStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { humanizeUserMessage } from '../common/humanize-user-message.util';
import { OperationAlertsService } from '../operation/operation-alerts.service';
import { AlertSchedulerService } from './alert-scheduler.service';

@Injectable()
export class AlertsService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly scheduler: AlertSchedulerService,
    private readonly opAlerts: OperationAlertsService,
  ) {}

  async listOpen(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const rows = await prisma.alert.findMany({
      where: { status: AlertStatus.OPEN },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((a) => ({
      ...a,
      message: humanizeUserMessage(a.message),
    }));
  }

  async acknowledge(user: JwtPayload, id: string) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.alert.update({
      where: { id },
      data: { status: AlertStatus.ACKNOWLEDGED },
    });
  }

  async scanWithdrawals(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const now = new Date();
    const events = await prisma.healthEvent.findMany({
      where: { withdrawalUntil: { gt: now } },
    });
    for (const e of events) {
      await prisma.alert.create({
        data: {
          type: 'WITHDRAWAL_PERIOD',
          title: 'Carência de medicamento',
          message: `${e.productName} — lote em carência até ${e.withdrawalUntil?.toISOString()}`,
          referenceId: e.id,
          dueAt: e.withdrawalUntil ?? undefined,
        },
      });
    }
    return { scanned: events.length };
  }

  async runFullScan(user: JwtPayload) {
    await this.scheduler.scanTenant(user.tenantSlug);
    await this.scanWithdrawals(user);
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    await this.opAlerts.resolveStaleOccurrenceAlerts(prisma);
    await this.opAlerts.scanTenant(user.tenantSlug);
    return { ok: true };
  }
}
