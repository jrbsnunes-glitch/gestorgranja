import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { CashService } from './cash.service';

@ApiTags('cash')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/cash')
export class CashController {
  constructor(private readonly cash: CashService) {}

  @Get('sessions/open/me')
  @RequirePermissions('cash.read', 'cash.write', '*')
  myOpen(@CurrentUser() user: JwtPayload) {
    return this.cash.myOpenSession(user);
  }

  @Get('sessions/open/list')
  @RequirePermissions('cash.read', 'cash.write', '*')
  openList(@CurrentUser() user: JwtPayload) {
    return this.cash.listOpenSessions(user);
  }

  @Get('sessions/pending-reconciliation')
  @RequirePermissions('cash.reconcile', 'cash.read', '*')
  pending(@CurrentUser() user: JwtPayload) {
    return this.cash.listPendingReconciliation(user);
  }

  @Get('sessions')
  @RequirePermissions('cash.read', 'cash.write', '*')
  sessions(@CurrentUser() user: JwtPayload) {
    return this.cash.listSessions(user);
  }

  @Get('sessions/:id/reconciliation')
  @RequirePermissions('cash.reconcile', 'cash.read', '*')
  sessionReconciliation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cash.getSessionReconciliation(user, id);
  }

  @Get('sessions/:id')
  @RequirePermissions('cash.read', 'cash.write', '*')
  sessionById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.cash.getSession(user, id);
  }

  @Post('sessions/open')
  @RequirePermissions('cash.write', '*')
  open(@CurrentUser() user: JwtPayload, @Body() body: { openingBalance: number }) {
    return this.cash.openSession(user, body.openingBalance);
  }

  @Post('sessions/:id/movements')
  @RequirePermissions('cash.write', 'cash.reconcile', '*')
  movement(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      type: 'IN' | 'OUT';
      amount: number;
      reason?: string;
      paymentMethod?: string;
      chartAccountId?: string;
      isExpense?: boolean;
    },
  ) {
    return this.cash.addMovement(user, id, body);
  }

  @Patch('sessions/:id/movements/:movementId')
  @RequirePermissions('cash.reconcile', 'cash.write', '*')
  updateMovement(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('movementId') movementId: string,
    @Body()
    body: {
      type?: 'IN' | 'OUT';
      amount?: number;
      reason?: string;
      paymentMethod?: string;
      chartAccountId?: string | null;
      isExpense?: boolean;
    },
  ) {
    return this.cash.updateMovement(user, id, movementId, body);
  }

  @Delete('sessions/:id/movements/:movementId')
  @RequirePermissions('cash.reconcile', 'cash.write', '*')
  deleteMovement(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('movementId') movementId: string,
  ) {
    return this.cash.deleteMovement(user, id, movementId);
  }

  @Post('sessions/:id/close')
  @RequirePermissions('cash.write', '*')
  close(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { closingBalance: number; closingNotes?: string },
  ) {
    return this.cash.requestClose(user, id, body.closingBalance, body.closingNotes);
  }

  @Patch('sessions/:id/reconcile')
  @RequirePermissions('cash.reconcile', '*')
  reconcile(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { notes?: string }) {
    return this.cash.reconcile(user, id, body.notes);
  }
}
