import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audited } from '../audit/audit.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UpsertFeedDto } from './dto/upsert-feed.dto';
import { NutritionService } from './nutrition.service';

@ApiTags('nutrition')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/nutrition')
export class NutritionController {
  constructor(private readonly nutrition: NutritionService) {}

  @Post('daily-feed')
  @RequirePermissions('nutrition.write', 'sync.write', '*')
  @Audited('DailyFeedConsumption')
  upsert(@CurrentUser() user: JwtPayload, @Body() dto: UpsertFeedDto) {
    return this.nutrition.upsertFeed(user, dto);
  }

  @Post('feed-transfer')
  @RequirePermissions('nutrition.write', '*')
  transfer(
    @CurrentUser() user: JwtPayload,
    @Body() body: { fromLotId: string; toLotId: string; date: string; quantityKg: number; notes?: string },
  ) {
    return this.nutrition.transferFeed(user, body);
  }

  @Get('daily-feed')
  @RequirePermissions('production.read', 'nutrition.write', '*')
  listFeed(@CurrentUser() user: JwtPayload, @Query('flockLotId') flockLotId?: string) {
    return this.nutrition.listDailyFeed(user, flockLotId);
  }

  @Get('feed-transfers')
  @RequirePermissions('production.read', 'nutrition.write', '*')
  listTransfers(@CurrentUser() user: JwtPayload) {
    return this.nutrition.listFeedTransfers(user);
  }
}
