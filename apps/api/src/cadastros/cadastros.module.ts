import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CadastrosController } from './cadastros.controller';
import { CadastrosService } from './cadastros.service';
import { GeneralCadastrosController } from './general-cadastros.controller';
import { GeneralCadastrosService } from './general-cadastros.service';

@Module({
  imports: [AuthModule],
  controllers: [CadastrosController, GeneralCadastrosController],
  providers: [CadastrosService, GeneralCadastrosService],
  exports: [CadastrosService, GeneralCadastrosService],
})
export class CadastrosModule {}
