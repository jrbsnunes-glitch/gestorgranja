import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ComplianceService } from './compliance.service';

@ApiTags('compliance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/compliance')
export class ComplianceController {
  constructor(private readonly compliance: ComplianceService) {}

  @Get('licenses')
  @RequirePermissions('reports.read', '*')
  list(@CurrentUser() user: JwtPayload) {
    return this.compliance.listLicenses(user);
  }

  @Post('licenses')
  @RequirePermissions('*')
  create(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.compliance.createLicense(user, body as Parameters<ComplianceService['createLicense']>[1]);
  }

  @Get('contracts')
  @RequirePermissions('reports.read', '*')
  contracts(@CurrentUser() user: JwtPayload) {
    return this.compliance.listContracts(user);
  }
}
