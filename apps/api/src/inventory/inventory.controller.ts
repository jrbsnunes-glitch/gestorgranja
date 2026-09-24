import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductGroupDto } from './dto/create-product-group.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { StockMovementDto } from './dto/stock-movement.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/inventory')
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get('product-groups')
  @RequirePermissions('inventory.write', '*')
  listGroups(@CurrentUser() user: JwtPayload) {
    return this.inventory.listProductGroups(user);
  }

  @Post('product-groups')
  @RequirePermissions('inventory.write', '*')
  createGroup(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductGroupDto) {
    return this.inventory.createProductGroup(user, dto);
  }

  @Get('products')
  @RequirePermissions('inventory.write', '*')
  list(@CurrentUser() user: JwtPayload) {
    return this.inventory.listProducts(user);
  }

  @Get('products/:id/price-history')
  @RequirePermissions('inventory.write', '*')
  priceHistory(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.inventory.listProductPriceHistory(user, id);
  }

  @Post('products')
  @RequirePermissions('inventory.write', '*')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateProductDto) {
    return this.inventory.createProduct(user, dto);
  }

  @Post('movements')
  @RequirePermissions('inventory.write', '*')
  move(@CurrentUser() user: JwtPayload, @Body() dto: StockMovementDto) {
    return this.inventory.moveStock(user, dto);
  }

  @Get('products/:id/balance')
  @RequirePermissions('inventory.write', '*')
  balance(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.inventory.stockBalance(user, id);
  }

  @Patch('products/:id')
  @RequirePermissions('inventory.write', '*')
  updateProduct(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.inventory.updateProduct(user, id, dto);
  }

  @Get('movements')
  @RequirePermissions('inventory.write', '*')
  listMovements(@CurrentUser() user: JwtPayload) {
    return this.inventory.listMovements(user);
  }

  @Get('stock-receipts')
  @RequirePermissions('inventory.write', '*')
  listReceipts(@CurrentUser() user: JwtPayload) {
    return this.inventory.listStockReceipts(user);
  }

  @Post('stock-receipts')
  @RequirePermissions('inventory.write', '*')
  createReceipt(@CurrentUser() user: JwtPayload, @Body() body: Parameters<InventoryService['createStockReceipt']>[1]) {
    return this.inventory.createStockReceipt(user, body);
  }
}
