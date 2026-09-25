import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantService } from './tenant.service';

@ApiTags('tenant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('v1/tenant')
export class TenantController {
  constructor(private readonly tenant: TenantService) {}

  @Get('subscription')
  subscription(@CurrentUser() user: JwtPayload) {
    return this.tenant.getSubscriptionForClient(user.tenantSlug);
  }
}
