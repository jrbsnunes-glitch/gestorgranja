import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommercialController } from './commercial.controller';
import { CommercialService } from './commercial.service';

@Module({
  imports: [AuthModule],
  controllers: [CommercialController],
  providers: [CommercialService],
})
export class CommercialModule {}
