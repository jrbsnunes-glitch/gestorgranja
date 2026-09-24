import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SanidadeController } from './sanidade.controller';
import { SanidadeService } from './sanidade.service';

@Module({
  imports: [AuthModule],
  controllers: [SanidadeController],
  providers: [SanidadeService],
})
export class SanidadeModule {}
