import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateHealthEventDto } from './dto/create-health-event.dto';
import { SanidadeService } from './sanidade.service';

@ApiTags('health')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/health')
export class SanidadeController {
  constructor(private readonly sanidade: SanidadeService) {}

  @Post('events')
  @RequirePermissions('health.write', '*')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateHealthEventDto) {
    return this.sanidade.createHealthEvent(user, dto);
  }

  @Get('events')
  @RequirePermissions('health.write', 'production.read', '*')
  listEvents(@CurrentUser() user: JwtPayload) {
    return this.sanidade.listHealthEvents(user);
  }

  @Get('biosecurity')
  @RequirePermissions('health.write', 'production.read', '*')
  listBio(@CurrentUser() user: JwtPayload) {
    return this.sanidade.listBiosecurity(user);
  }

  @Post('biosecurity')
  @RequirePermissions('health.write', '*')
  createBio(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.sanidade.createBiosecurity(user, body as Parameters<SanidadeService['createBiosecurity']>[1]);
  }

  @Get('sanitary-products')
  @RequirePermissions('health.write', '*')
  searchProducts(@CurrentUser() user: JwtPayload, @Query('q') q?: string) {
    return this.sanidade.searchSanitaryProducts(user, q ?? '');
  }

  @Post('sanitary-products')
  @RequirePermissions('health.write', '*')
  createProduct(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.sanidade.createSanitaryProduct(user, body);
  }
}
