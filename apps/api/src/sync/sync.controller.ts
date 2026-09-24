import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { SyncBatchDto } from './dto/sync-batch.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post('batch')
  @RequirePermissions('sync.write', '*')
  batch(@CurrentUser() user: JwtPayload, @Body() dto: SyncBatchDto) {
    return this.sync.processBatch(user, dto);
  }

  @Get('conflicts')
  @RequirePermissions('admin.users', 'production.read', '*')
  conflicts(@CurrentUser() user: JwtPayload) {
    return this.sync.listConflicts(user);
  }
}
