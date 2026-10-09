import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TenantProvisioningStatus } from '../generated/central-client';
import { CentralPrismaService } from '../prisma/central-prisma.service';
import { SicoobCobrancaService } from './sicoob-cobranca.service';

@Injectable()
export class SicoobConciliationScheduler {
  private readonly logger = new Logger(SicoobConciliationScheduler.name);

  constructor(
    private readonly central: CentralPrismaService,
    private readonly sicoob: SicoobCobrancaService,
  ) {}

  @Cron('*/20 * * * *')
  async tick() {
    const tenants = await this.central.tenant.findMany({
      where: { provisioningStatus: TenantProvisioningStatus.READY },
      select: { slug: true },
    });
    for (const t of tenants) {
      try {
        const r = await this.sicoob.conciliateTenant(t.slug);
        if (r.paid > 0) {
          this.logger.log(`Sicoob conciliação ${t.slug}: ${r.paid}/${r.checked} liquidados`);
        }
      } catch (e) {
        this.logger.warn(`Sicoob conciliação falhou ${t.slug}: ${(e as Error).message}`);
      }
    }
  }
}
