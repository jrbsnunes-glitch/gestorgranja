import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { PersonalAgendaService } from './personal-agenda.service';

@ApiTags('personal-agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/personal-agenda')
export class PersonalAgendaController {
  constructor(private readonly agenda: PersonalAgendaService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.agenda.list(user);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: { description: string; amount: number; dueDate: string; installments?: number; category?: string },
  ) {
    return this.agenda.create(user, body);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { description?: string; amount?: number; dueDate?: string; category?: string },
  ) {
    return this.agenda.update(user, id, body);
  }

  @Post(':id/pay')
  pay(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { amount?: number; settlementDate?: string; notes?: string; paymentLabel?: string },
  ) {
    return this.agenda.pay(user, id, body ?? {});
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.agenda.remove(user, id);
  }
}
