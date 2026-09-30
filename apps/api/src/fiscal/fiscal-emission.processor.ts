import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { FiscalDocumentStatus } from '../generated/tenant-client';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { EmitJobPayload, FiscalEmissionService } from './fiscal-emission.service';

@Processor('fiscal-emission')
export class FiscalEmissionProcessor extends WorkerHost {
  private readonly logger = new Logger(FiscalEmissionProcessor.name);

  constructor(
    private readonly emission: FiscalEmissionService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {
    super();
  }

  async process(job: Job<EmitJobPayload>) {
    try {
      const result = await this.emission.processEmission(job.data);
      this.logger.log(`Fiscal ${job.data.fiscalDocumentId} → ${result.status}`);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`Fiscal ${job.data.fiscalDocumentId} falhou: ${msg}`);
      const prisma = await this.tenantPrisma.getClient(job.data.tenantSlug);
      await prisma.fiscalDocument.update({
        where: { id: job.data.fiscalDocumentId },
        data: { status: FiscalDocumentStatus.REJECTED, errorMessage: msg.slice(0, 500) },
      });
      throw e;
    }
  }
}
