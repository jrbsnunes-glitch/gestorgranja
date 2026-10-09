import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { AuditService } from './audit.service';

@ApiTags('audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get('logs')
  @RequirePermissions('*', 'admin.users', 'production.read')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('entity') entity?: string,
    @Query('entityId') entityId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.listLogs(user.tenantSlug, {
      entity,
      entityId,
      limit: limit ? Number(limit) : 100,
    });
  }

  @Get('records/:entity/:id/history')
  @RequirePermissions('*', 'admin.users', 'production.read')
  recordHistory(
    @CurrentUser() user: JwtPayload,
    @Param('entity') entity: string,
    @Param('id') id: string,
  ) {
    return this.audit.historyFor(user.tenantSlug, entity, id);
  }
}
