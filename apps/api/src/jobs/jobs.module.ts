import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ReportsModule } from '../reports/reports.module';
import { MetricsProcessor } from './metrics.processor';

@Module({
  imports: [
    ReportsModule,
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: { url: config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6382' },
      }),
    }),
    BullModule.registerQueue({ name: 'zootechnical-metrics' }),
  ],
  providers: [MetricsProcessor],
  exports: [BullModule],
})
export class JobsModule {}
