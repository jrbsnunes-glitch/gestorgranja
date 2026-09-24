import { Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { AlertsService } from './alerts.service';

@ApiTags('alerts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @RequirePermissions('reports.read', '*')
  list(@CurrentUser() user: JwtPayload) {
    return this.alerts.listOpen(user);
  }

  @Patch(':id/ack')
  @RequirePermissions('reports.read', '*')
  ack(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.alerts.acknowledge(user, id);
  }

  @Post('scan/withdrawals')
  @RequirePermissions('*')
  scan(@CurrentUser() user: JwtPayload) {
    return this.alerts.scanWithdrawals(user);
  }

  @Post('scan/all')
  @RequirePermissions('*')
  scanAll(@CurrentUser() user: JwtPayload) {
    return this.alerts.runFullScan(user);
  }
}
