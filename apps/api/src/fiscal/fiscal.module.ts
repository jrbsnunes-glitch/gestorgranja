import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsModule } from '../jobs/jobs.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FiscalCertService } from './fiscal-cert.service';
import { FiscalCryptoService } from './fiscal-crypto.service';
import { FiscalEmissionProcessor } from './fiscal-emission.processor';
import { FiscalEmissionService } from './fiscal-emission.service';
import { FiscalController } from './fiscal.controller';
import { FiscalService } from './fiscal.service';
import { NfeXmlBuilder } from './nfe/nfe-xml.builder';
import { NfeXmlSignService } from './nfe/nfe-xml-sign.service';
import { SefazSoapClient } from './sefaz/sefaz-soap.client';

@Module({
  imports: [AuthModule, PrismaModule, JobsModule, BullModule.registerQueue({ name: 'fiscal-emission' })],
  controllers: [FiscalController],
  providers: [
    FiscalService,
    FiscalCryptoService,
    FiscalCertService,
    FiscalEmissionService,
    FiscalEmissionProcessor,
    NfeXmlBuilder,
    NfeXmlSignService,
    SefazSoapClient,
  ],
  exports: [FiscalService, FiscalCryptoService],
})
export class FiscalModule {}
