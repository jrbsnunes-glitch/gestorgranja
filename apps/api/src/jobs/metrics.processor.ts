import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ZootechnicalMetricsService } from '../reports/zootechnical-metrics.service';

@Processor('zootechnical-metrics')
export class MetricsProcessor extends WorkerHost {
  private readonly logger = new Logger(MetricsProcessor.name);

  constructor(private readonly metrics: ZootechnicalMetricsService) {
    super();
  }

  async process(job: Job<{ tenantSlug: string; flockLotId: string }>) {
    const result = await this.metrics.dashboard(job.data.tenantSlug, job.data.flockLotId);
    this.logger.debug(`KPIs recalculados ${job.data.flockLotId}`);
    return result;
  }
}
