import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { type BarnPayload, CadastrosService } from './cadastros.service';

@ApiTags('cadastros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/cadastros')
export class CadastrosController {
  constructor(private readonly cadastros: CadastrosService) {}

  @Get('barns')
  @RequirePermissions('production.read', '*')
  listBarns(@CurrentUser() user: JwtPayload) {
    return this.cadastros.listBarns(user);
  }

  @Get('barns/responsible-options')
  @RequirePermissions('production.write', 'operation.settings', '*')
  responsibleOptions(@CurrentUser() user: JwtPayload) {
    return this.cadastros.listResponsibleOptions(user);
  }

  @Post('barns')
  @RequirePermissions('operation.settings', '*')
  createBarn(@CurrentUser() user: JwtPayload, @Body() body: BarnPayload) {
    return this.cadastros.createBarn(user, body);
  }

  @Patch('barns/:id')
  @RequirePermissions('operation.settings', '*')
  updateBarn(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: BarnPayload) {
    return this.cadastros.updateBarn(user, id, body);
  }

  @Get('breed-lineages')
  @RequirePermissions('production.read', '*')
  lineages(@CurrentUser() user: JwtPayload) {
    return this.cadastros.listBreedLineages(user);
  }

  @Get('partners')
  @RequirePermissions('finance.write', '*')
  partners(@CurrentUser() user: JwtPayload) {
    return this.cadastros.listPartners(user);
  }

  @Post('partners')
  @RequirePermissions('finance.write', '*')
  createPartner(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.cadastros.createPartner(user, body as import('./partner-payload').PartnerPayload);
  }

  @Patch('partners/:id')
  @RequirePermissions('finance.write', '*')
  updatePartner(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.cadastros.updatePartner(user, id, body as import('./partner-payload').PartnerPayload);
  }

  @Post('flock-lots')
  @RequirePermissions('production.write', '*')
  createLot(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.cadastros.createFlockLot(user, body as Parameters<CadastrosService['createFlockLot']>[1]);
  }

  @Patch('flock-lots/:id')
  @RequirePermissions('production.write', '*')
  patchLot(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.cadastros.updateFlockLot(user, id, body);
  }
}
