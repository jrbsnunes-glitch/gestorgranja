import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Audited } from '../audit/audit.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UpsertDailyEggDto } from './dto/upsert-daily-egg.dto';
import { UpsertDailyMortalityDto } from './dto/upsert-daily-mortality.dto';
import { EggProductionStockService } from './egg-production-stock.service';
import { ProductionService } from './production.service';

@ApiTags('production')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/production')
export class ProductionController {
  constructor(
    private readonly production: ProductionService,
    private readonly eggStock: EggProductionStockService,
  ) {}

  @Get('lots')
  @RequirePermissions('production.read', '*')
  listLots(@CurrentUser() user: JwtPayload) {
    return this.production.listLots(user);
  }

  @Post('environmental')
  @RequirePermissions('production.write', '*')
  environmental(
    @CurrentUser() user: JwtPayload,
    @Body() body: { barnId: string; temperatureC?: number; humidityPct?: number; ventilationNote?: string },
  ) {
    return this.production.createEnvironmentalReading(user, body);
  }

  @Post('daily-eggs')
  @RequirePermissions('production.write', 'sync.write', '*')
  upsertEgg(@CurrentUser() user: JwtPayload, @Body() dto: UpsertDailyEggDto) {
    return this.production.upsertDailyEgg(user, dto).then((r) => r.row);
  }

  @Post('daily-mortality')
  @RequirePermissions('production.write', '*')
  @Audited('DailyMortality')
  createMortality(@CurrentUser() user: JwtPayload, @Body() dto: UpsertDailyMortalityDto) {
    return this.production.createDailyMortality(user, dto);
  }

  @Patch('daily-mortality/:id')
  @RequirePermissions('production.write', '*')
  @Audited('DailyMortality')
  updateMortality(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpsertDailyMortalityDto,
  ) {
    return this.production.updateDailyMortality(user, id, dto);
  }

  @Get('daily-eggs')
  @RequirePermissions('production.read', '*')
  listEggs(@CurrentUser() user: JwtPayload, @Query('flockLotId') flockLotId?: string) {
    return this.production.listDailyEggs(user, flockLotId);
  }

  @Get('daily-mortality')
  @RequirePermissions('production.read', '*')
  listMortality(@CurrentUser() user: JwtPayload, @Query('flockLotId') flockLotId?: string) {
    return this.production.listDailyMortality(user, flockLotId);
  }

  @Get('environmental')
  @RequirePermissions('production.read', '*')
  listEnvironmental(@CurrentUser() user: JwtPayload) {
    return this.production.listEnvironmental(user);
  }

  @Get('egg-stock-config')
  @RequirePermissions('production.read', 'inventory.write', '*')
  eggStockConfig(@CurrentUser() user: JwtPayload) {
    return this.eggStock.getConfig(user.tenantSlug);
  }

  @Patch('egg-stock-config')
  @RequirePermissions('production.write', 'inventory.write', '*')
  updateEggStockConfig(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.eggStock.updateConfig(user.tenantSlug, body as Parameters<EggProductionStockService['updateConfig']>[1]);
  }

  @Post('egg-stock-config/resync')
  @Audited('production.egg-stock.resync')
  @RequirePermissions('production.write', 'inventory.write', '*')
  resyncEggStock(@CurrentUser() user: JwtPayload) {
    return this.eggStock.resyncAllFromProduction(user);
  }

  @Post('egg-stock-config/apply-costs')
  @Audited('production.egg-stock.apply-costs')
  @RequirePermissions('production.write', 'inventory.write', '*')
  applyEggStockCosts(@CurrentUser() user: JwtPayload) {
    return this.eggStock.applyProductionMovementCosts(user);
  }
}
