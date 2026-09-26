import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { DailySummaryService } from './daily-summary.service';
import {
  CreateMaintenanceFromOccurrenceDto,
  CreateOccurrenceDto,
  UpdateOccurrenceDto,
} from './dto/occurrence.dto';
import { UpsertOperationalLossDto } from './dto/operational-loss.dto';
import { ReviewDayDto, ReviewManyDto, ReviewOneDto, UpdateOperationSettingsDto } from './dto/review.dto';
import { UpsertSupplyConsumptionDto } from './dto/supply-consumption.dto';
import { ConsumptionStockSyncService } from './consumption-stock-sync.service';
import { OccurrencesService } from './occurrences.service';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { OperationAlertsService } from './operation-alerts.service';
import { OperationDashboardService } from './operation-dashboard.service';
import { OperationSettingsService } from './operation-settings.service';
import { OperationalLossService } from './operational-loss.service';
import { PendingService } from './pending.service';
import { ReviewService } from './review.service';
import { SupplyConsumptionService } from './supply-consumption.service';

@ApiTags('operation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/operation')
export class OperationController {
  constructor(
    private readonly occurrences: OccurrencesService,
    private readonly supplies: SupplyConsumptionService,
    private readonly losses: OperationalLossService,
    private readonly dailySummary: DailySummaryService,
    private readonly review: ReviewService,
    private readonly pending: PendingService,
    private readonly settings: OperationSettingsService,
    private readonly stockSync: ConsumptionStockSyncService,
    private readonly dashboard_: OperationDashboardService,
    private readonly opAlerts: OperationAlertsService,
    private readonly tenantPrisma: TenantPrismaService,
  ) {}

  private tenantPrismaForScan(user: JwtPayload) {
    return this.tenantPrisma.getClient(user.tenantSlug);
  }

  // --- Configurações do módulo ---

  @Get('settings')
  @RequirePermissions('production.read', 'production.write', 'operation.settings', '*')
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.settings.get(user.tenantSlug);
  }

  @Patch('settings')
  @RequirePermissions('operation.settings', '*')
  updateSettings(@CurrentUser() user: JwtPayload, @Body() dto: UpdateOperationSettingsDto) {
    return this.settings.update(user.tenantSlug, dto);
  }

  @Post('settings/resync-consumption')
  @RequirePermissions('operation.settings', '*')
  resyncConsumption(@CurrentUser() user: JwtPayload) {
    return this.stockSync.resyncAll(user.tenantSlug);
  }

  @Post('alerts/scan')
  @RequirePermissions('operation.settings', 'production.review', '*')
  async scanAlerts(@CurrentUser() user: JwtPayload) {
    const prisma = await this.tenantPrismaForScan(user);
    const resolved = await this.opAlerts.resolveStaleOccurrenceAlerts(prisma);
    const r = await this.opAlerts.scanTenant(user.tenantSlug);
    return { ...r, resolved };
  }

  // --- Conferência ---

  @Patch('review/:entity/:id')
  @RequirePermissions('production.review', '*')
  reviewOne(
    @CurrentUser() user: JwtPayload,
    @Param('entity') entity: string,
    @Param('id') id: string,
    @Body() dto: ReviewOneDto,
  ) {
    return this.review.review(user, entity, id, dto?.note);
  }

  @Post('review')
  @RequirePermissions('production.review', '*')
  reviewMany(@CurrentUser() user: JwtPayload, @Body() dto: ReviewManyDto) {
    return this.review.reviewMany(user, dto.items, dto.note);
  }

  @Post('review/day')
  @RequirePermissions('production.review', '*')
  reviewDay(@CurrentUser() user: JwtPayload, @Body() dto: ReviewDayDto) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dto.date)) throw new BadRequestException('Data inválida (AAAA-MM-DD).');
    return this.review.reviewDay(user, dto.date, dto.barnId, dto.note);
  }

  // --- Pendências ---

  @Get('pending')
  @RequirePermissions('production.read', 'production.write', 'production.review', '*')
  pendingList(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('barnId') barnId?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const end = to ?? today;
    const start = from ?? new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new BadRequestException('Período inválido (AAAA-MM-DD).');
    }
    return this.pending.list(user, start, end, barnId || undefined);
  }

  // --- Dashboard operacional ---

  @Get('dashboard')
  @RequirePermissions('production.read', 'production.write', 'reports.read', '*')
  dashboard(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('barnId') barnId?: string,
    @Query('flockLotId') flockLotId?: string,
  ) {
    const today = new Date().toISOString().slice(0, 10);
    const end = to ?? today;
    const start = from ?? new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      throw new BadRequestException('Período inválido (AAAA-MM-DD).');
    }
    return this.dashboard_.build(user, { from: start, to: end, barnId: barnId || undefined, flockLotId: flockLotId || undefined });
  }

  // --- Registro diário ---

  @Get('daily-summary')
  @RequirePermissions('production.read', 'production.write', '*')
  dailySummaryFor(
    @CurrentUser() user: JwtPayload,
    @Query('date') date?: string,
    @Query('barnId') barnId?: string,
  ) {
    const d = date ?? new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new BadRequestException('Data inválida (AAAA-MM-DD).');
    return this.dailySummary.forDate(user, d, barnId || undefined);
  }

  // --- Ocorrências ---

  @Get('occurrences')
  @RequirePermissions('production.read', 'occurrences.write', '*')
  listOccurrences(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('barnId') barnId?: string,
    @Query('flockLotId') flockLotId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.occurrences.list(user, { status, barnId, flockLotId, from, to });
  }

  @Get('occurrences/asset-options')
  @RequirePermissions('production.read', 'occurrences.write', '*')
  assetOptions(@CurrentUser() user: JwtPayload) {
    return this.occurrences.assetOptions(user);
  }

  @Post('occurrences')
  @RequirePermissions('occurrences.write', 'production.write', '*')
  createOccurrence(@CurrentUser() user: JwtPayload, @Body() dto: CreateOccurrenceDto) {
    return this.occurrences.create(user, dto);
  }

  @Patch('occurrences/:id')
  @RequirePermissions('occurrences.write', '*')
  updateOccurrence(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateOccurrenceDto) {
    return this.occurrences.update(user, id, dto);
  }

  @Post('occurrences/:id/maintenance')
  @RequirePermissions('occurrences.write', '*')
  occurrenceMaintenance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateMaintenanceFromOccurrenceDto,
  ) {
    return this.occurrences.createMaintenance(user, id, dto);
  }

  // --- Opções auxiliares (listas leves) ---

  @Get('product-options')
  @RequirePermissions('production.read', 'production.write', '*')
  productOptions(@CurrentUser() user: JwtPayload, @Query('type') type?: string) {
    return this.supplies.productOptions(user, type || undefined);
  }

  @Get('stock-location-options')
  @RequirePermissions('production.read', 'production.write', '*')
  stockLocationOptions(@CurrentUser() user: JwtPayload) {
    return this.supplies.stockLocationOptions(user);
  }

  // --- Consumo de insumos ---

  @Get('supply-consumptions')
  @RequirePermissions('production.read', 'inventory.write', '*')
  listSupplies(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('barnId') barnId?: string,
    @Query('productId') productId?: string,
  ) {
    return this.supplies.list(user, { from, to, barnId, productId });
  }

  @Post('supply-consumptions')
  @RequirePermissions('production.write', 'inventory.write', '*')
  createSupply(@CurrentUser() user: JwtPayload, @Body() dto: UpsertSupplyConsumptionDto) {
    return this.supplies.create(user, dto);
  }

  @Patch('supply-consumptions/:id')
  @RequirePermissions('production.write', 'inventory.write', '*')
  updateSupply(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpsertSupplyConsumptionDto) {
    return this.supplies.update(user, id, dto);
  }

  // --- Perdas ---

  @Get('losses')
  @RequirePermissions('production.read', '*')
  listLosses(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('barnId') barnId?: string,
    @Query('type') type?: string,
  ) {
    return this.losses.list(user, { from, to, barnId, type });
  }

  @Post('losses')
  @RequirePermissions('production.write', '*')
  createLoss(@CurrentUser() user: JwtPayload, @Body() dto: UpsertOperationalLossDto) {
    return this.losses.create(user, dto);
  }

  @Patch('losses/:id')
  @RequirePermissions('production.write', '*')
  updateLoss(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpsertOperationalLossDto) {
    return this.losses.update(user, id, dto);
  }
}
