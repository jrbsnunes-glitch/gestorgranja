import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { FiscalService } from './fiscal.service';

@ApiTags('fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Get('issuer-settings')
  @RequirePermissions('*')
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.fiscal.getIssuerSettings(user);
  }

  @Patch('issuer-settings')
  @RequirePermissions('*')
  patchSettings(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.fiscal.updateIssuerSettings(user, body as Parameters<FiscalService['updateIssuerSettings']>[1]);
  }

  @Post('emit/:salesOrderId')
  @RequirePermissions('*')
  emit(@CurrentUser() user: JwtPayload, @Param('salesOrderId') salesOrderId: string) {
    return this.fiscal.queueEmission(user, salesOrderId);
  }
}
