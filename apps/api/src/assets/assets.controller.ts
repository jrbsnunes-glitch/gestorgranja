import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { AssetsService } from './assets.service';

@ApiTags('assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/assets')
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  @RequirePermissions('*')
  list(@CurrentUser() user: JwtPayload) {
    return this.assets.listAssets(user);
  }

  @Post()
  @RequirePermissions('*')
  create(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.assets.createAsset(user, body as Parameters<AssetsService['createAsset']>[1]);
  }

  @Post(':id/maintenance')
  @RequirePermissions('*')
  maintenance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.assets.addMaintenance(user, id, body as Parameters<AssetsService['addMaintenance']>[2]);
  }

  @Get('projects/list')
  @RequirePermissions('*')
  projects(@CurrentUser() user: JwtPayload) {
    return this.assets.listProjects(user);
  }

  @Post('projects')
  @RequirePermissions('*')
  createProject(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.assets.createProject(user, body as Parameters<AssetsService['createProject']>[1]);
  }
}
