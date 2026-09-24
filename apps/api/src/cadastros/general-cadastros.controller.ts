import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { GeneralCadastrosService } from './general-cadastros.service';

@ApiTags('cadastros-gerais')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/cadastros')
export class GeneralCadastrosController {
  constructor(private readonly general: GeneralCadastrosService) {}

  @Get('company')
  @RequirePermissions('cadastros.read', '*')
  company(@CurrentUser() user: JwtPayload) {
    return this.general.getCompany(user);
  }

  @Get('company/branding')
  @RequirePermissions(
    'cadastros.read',
    'reports.read',
    'cash.read',
    'cash.write',
    'finance.write',
    'hr.read',
    '*',
  )
  companyBranding(@CurrentUser() user: JwtPayload) {
    return this.general.getCompanyBranding(user);
  }

  @Patch('company')
  @RequirePermissions('cadastros.write', '*')
  patchCompany(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.general.updateCompany(user, body);
  }

  @Post('company/logo')
  @RequirePermissions('cadastros.write', '*')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadCompanyLogo(@CurrentUser() user: JwtPayload, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.general.uploadCompanyLogo(user, file);
  }

  @Get('company/logo')
  @RequirePermissions(
    'cadastros.read',
    'reports.read',
    'cash.read',
    'cash.write',
    'finance.write',
    'hr.read',
    '*',
  )
  async companyLogo(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    const filePath = this.general.getCompanyLogoFilePath(user);
    if (!filePath) throw new NotFoundException('Logo não cadastrado');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.sendFile(filePath);
  }

  @Get('general/cities')
  @RequirePermissions('cadastros.read', '*')
  cities(@CurrentUser() user: JwtPayload) {
    return this.general.listCities(user);
  }

  @Post('general/cities')
  @RequirePermissions('cadastros.write', '*')
  createCity(@CurrentUser() user: JwtPayload, @Body() body: { name: string; state: string; ibgeCode?: string }) {
    return this.general.createCity(user, body);
  }

  @Get('general/districts')
  @RequirePermissions('cadastros.read', '*')
  districts(@CurrentUser() user: JwtPayload, @Query('cityId') cityId?: string) {
    return this.general.listDistricts(user, cityId);
  }

  @Post('general/districts')
  @RequirePermissions('cadastros.write', '*')
  createDistrict(@CurrentUser() user: JwtPayload, @Body() body: { name: string; cityId: string }) {
    return this.general.createDistrict(user, body);
  }

  @Get('general/banks')
  @RequirePermissions('cadastros.read', 'finance.write', '*')
  banks(@CurrentUser() user: JwtPayload) {
    return this.general.listBanks(user);
  }

  @Post('general/banks')
  @RequirePermissions('cadastros.write', '*')
  createBank(@CurrentUser() user: JwtPayload, @Body() body: { compeCode: string; name: string }) {
    return this.general.createBank(user, body);
  }

  @Patch('general/banks/:id')
  @RequirePermissions('cadastros.write', '*')
  patchBank(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { name?: string; isActive?: boolean }) {
    return this.general.updateBank(user, id, body);
  }

  @Get('general/fiscal-situations')
  @RequirePermissions('cadastros.read', '*')
  fiscal(@CurrentUser() user: JwtPayload) {
    return this.general.listFiscalSituations(user);
  }

  @Post('general/fiscal-situations')
  @RequirePermissions('cadastros.write', '*')
  createFiscal(@CurrentUser() user: JwtPayload, @Body() body: { code: string; description: string }) {
    return this.general.createFiscalSituation(user, body);
  }

  @Get('general/stock-locations')
  @RequirePermissions('cadastros.read', 'inventory.write', '*')
  stockLocations(@CurrentUser() user: JwtPayload) {
    return this.general.listStockLocations(user);
  }

  @Post('general/stock-locations')
  @RequirePermissions('cadastros.write', '*')
  createStockLocation(
    @CurrentUser() user: JwtPayload,
    @Body() body: { code: string; name: string; barnId?: string },
  ) {
    return this.general.createStockLocation(user, body);
  }

  @Get('work-shifts')
  @RequirePermissions('cadastros.read', 'hr.read', '*')
  workShifts(@CurrentUser() user: JwtPayload) {
    return this.general.listWorkShifts(user);
  }

  @Post('work-shifts')
  @RequirePermissions('cadastros.write', '*')
  createWorkShift(
    @CurrentUser() user: JwtPayload,
    @Body() body: { code: string; name: string; startTime: string; endTime: string; breakMinutes?: number },
  ) {
    return this.general.createWorkShift(user, body);
  }

  @Patch('work-shifts/:id')
  @RequirePermissions('cadastros.write', '*')
  patchWorkShift(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.general.updateWorkShift(user, id, body);
  }

  @Delete('work-shifts/:id')
  @RequirePermissions('cadastros.write', '*')
  deleteWorkShift(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.general.deleteWorkShift(user, id);
  }

  @Get('chart-accounts')
  @RequirePermissions('cadastros.read', 'finance.write', 'inventory.write', '*')
  chartAccounts(
    @CurrentUser() user: JwtPayload,
    @Query('flow') flow?: 'payable' | 'receivable' | 'stock',
    @Query('posting') posting?: string,
  ) {
    return this.general.listChartAccounts(user, {
      flow,
      postingOnly: posting === '1' || posting === 'true',
    });
  }

  @Post('chart-accounts')
  @RequirePermissions('cadastros.write', '*')
  createChartAccount(
    @CurrentUser() user: JwtPayload,
    @Body() body: { code: string; name: string; type: string; parentId?: string; isPosting?: boolean },
  ) {
    return this.general.createChartAccount(user, body);
  }

  @Patch('chart-accounts/:id')
  @RequirePermissions('cadastros.write', '*')
  patchChartAccount(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.general.updateChartAccount(user, id, body);
  }

  @Delete('chart-accounts/:id')
  @RequirePermissions('cadastros.write', '*')
  deleteChartAccount(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.general.deleteChartAccount(user, id);
  }
}
