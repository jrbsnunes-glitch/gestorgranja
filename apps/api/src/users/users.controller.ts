import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions('admin.users', '*')
  list(@CurrentUser() user: JwtPayload) {
    return this.users.list(user);
  }

  @Post()
  @RequirePermissions('admin.users', '*')
  create(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.users.createUser(user, body as Parameters<UsersService['createUser']>[1]);
  }

  @Post('assign-role')
  @RequirePermissions('admin.users', '*')
  assign(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.users.assignRole(user, body as Parameters<UsersService['assignRole']>[1]);
  }

  @Patch(':id')
  @RequirePermissions('admin.users', '*')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      isActive?: boolean;
      email?: string;
      username?: string;
      password?: string;
    },
  ) {
    return this.users.updateUser(user, id, body);
  }
}
