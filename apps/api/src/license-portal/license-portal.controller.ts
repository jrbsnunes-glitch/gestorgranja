import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  ActivateLicenseDto,
  AdminPasswordDto,
  PortalLoginDto,
  ProvisionPortalTenantDto,
  RevalidateLicenseDto,
} from './license-portal.dto';
import { LicensePortalService } from './license-portal.service';
import { PortalJwtGuard } from './portal-jwt.guard';

@ApiTags('license-portal')
@Controller('v1/license-portal')
export class LicensePortalController {
  constructor(private readonly portal: LicensePortalService) {}

  @Post('auth/login')
  login(@Body() body: PortalLoginDto) {
    return this.portal.login(body);
  }

  @Get('plans')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  plans() {
    return this.portal.listPlans();
  }

  @Get('tenants')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  listTenants() {
    return this.portal.listTenants();
  }

  @Post('tenants')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  provision(@Body() body: ProvisionPortalTenantDto) {
    return this.portal.provisionTenant(body);
  }

  @Patch('tenants/:slug/license/revalidate')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  revalidate(@Param('slug') slug: string, @Body() body: RevalidateLicenseDto) {
    return this.portal.revalidateLicense(slug, body);
  }

  @Patch('tenants/:slug/license/pause')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  pause(@Param('slug') slug: string) {
    return this.portal.pauseLicense(slug);
  }

  @Patch('tenants/:slug/license/activate')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  activate(@Param('slug') slug: string, @Body() body: ActivateLicenseDto) {
    return this.portal.activateLicense(slug, body);
  }

  @Delete('tenants/:slug')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  archive(@Param('slug') slug: string) {
    return this.portal.archiveTenant(slug);
  }

  @Patch('tenants/:slug/admin-password')
  @ApiBearerAuth()
  @UseGuards(PortalJwtGuard)
  adminPassword(@Param('slug') slug: string, @Body() body: AdminPasswordDto) {
    return this.portal.updateAdminPassword(slug, body);
  }
}
