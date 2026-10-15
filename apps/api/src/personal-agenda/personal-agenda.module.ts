import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonalAgendaController } from './personal-agenda.controller';
import { PersonalAgendaService } from './personal-agenda.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonalAgendaController],
  providers: [PersonalAgendaService],
})
export class PersonalAgendaModule {}
