import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { CommercialService } from './commercial.service';

@ApiTags('commercial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/commercial')
export class CommercialController {
  constructor(private readonly commercial: CommercialService) {}

  @Get('orders')
  @RequirePermissions('sales.read', 'finance.write', '*')
  list(@CurrentUser() user: JwtPayload) {
    return this.commercial.listOrders(user);
  }

  @Post('orders')
  @RequirePermissions('sales.write', 'finance.write', '*')
  create(@CurrentUser() user: JwtPayload, @Body() body: Parameters<CommercialService['createOrder']>[1]) {
    return this.commercial.createOrder(user, body);
  }

  @Post('orders/:id/confirm')
  @RequirePermissions('sales.write', '*')
  confirm(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.commercial.confirmOrder(user, id);
  }
}
