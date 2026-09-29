import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { HomeDashboardService } from './home-dashboard.service';

@ApiTags('home')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/home')
export class HomeController {
  constructor(private readonly home: HomeDashboardService) {}

  @Get('dashboard')
  @RequirePermissions(
    'reports.read',
    'production.read',
    'finance.write',
    'cash.read',
    'inventory.write',
    'sales.read',
    '*',
  )
  dashboard(@CurrentUser() user: JwtPayload) {
    return this.home.build(user);
  }
}
