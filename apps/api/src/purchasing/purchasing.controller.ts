import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { PurchasingService } from './purchasing.service';

@ApiTags('purchasing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/purchasing')
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('requests')
  @RequirePermissions('purchasing.write', '*')
  list(@CurrentUser() user: JwtPayload) {
    return this.purchasing.listRequests(user);
  }

  @Post('requests')
  @RequirePermissions('purchasing.write', '*')
  createRequest(
    @CurrentUser() user: JwtPayload,
    @Body() body: { code: string; description: string; items: { productId: string; quantity: number }[] },
  ) {
    return this.purchasing.createRequest(user, body.code, body.description, body.items ?? []);
  }

  @Patch('requests/:id/items')
  @RequirePermissions('purchasing.write', '*')
  updateRequestItems(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { items: { productId: string; quantity: number }[] },
  ) {
    return this.purchasing.updateRequestItems(user, id, body.items ?? []);
  }

  @Post('requests/:id/quotes')
  @RequirePermissions('purchasing.write', '*')
  addQuote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      supplierName: string;
      partnerId?: string;
      totalAmount: number;
      items: { productId: string; unitPrice: number }[];
      paymentTermsJson?: unknown;
    },
  ) {
    return this.purchasing.addQuote(
      user,
      id,
      body.supplierName,
      body.partnerId,
      body.totalAmount,
      body.items ?? [],
      body.paymentTermsJson,
    );
  }

  @Patch('quotes/:quoteId/payment-terms')
  @RequirePermissions('purchasing.write', 'finance.write', '*')
  updateQuoteTerms(
    @CurrentUser() user: JwtPayload,
    @Param('quoteId') quoteId: string,
    @Body() body: { paymentTermsJson: unknown },
  ) {
    return this.purchasing.updateQuotePaymentTerms(user, quoteId, body.paymentTermsJson);
  }

  @Post('requests/:id/order')
  @RequirePermissions('purchasing.write', '*')
  order(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: {
      quoteId: string;
      orderNumber: string;
      financeApproved?: boolean;
      highImpact?: boolean;
    },
  ) {
    return this.purchasing.selectQuoteAndOrder(user, id, body.quoteId, body.orderNumber, {
      financeApproved: body.financeApproved,
      highImpact: body.highImpact,
    });
  }

  @Post('orders/:id/receive')
  @RequirePermissions('purchasing.write', '*')
  receive(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body()
    body: { notes?: string; partnerId: string; stockLocationId?: string; chartAccountId?: string },
  ) {
    return this.purchasing.receive(user, id, body);
  }
}
