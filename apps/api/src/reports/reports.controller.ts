import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { ProductionCostReportService } from './production-cost-report.service';
import { ReportsStubService } from './reports-stub.service';
import { EggProductionStockService } from '../production/egg-production-stock.service';
import { FinanceTitlesReportService } from './finance-titles-report.service';
import { ReceivableAgingReportService } from './receivable-aging-report.service';
import { CashReportService } from './cash-report.service';
import {
  ProductionDailyReportService,
  type ProductionReportDomain,
  type ProductionReportVariant,
} from './production-daily-report.service';
import {
  ProductsReportService,
  type ProductsReportVariant,
} from './products-report.service';
import { StockMovementsReportService } from './stock-movements-report.service';
import { StockReceiptsReportService } from './stock-receipts-report.service';
import { PurchaseOrdersReportService } from './purchase-orders-report.service';
import { SalesOrdersReportService } from './sales-orders-report.service';
import { HrEmployeesReportService } from './hr-employees-report.service';
import { HrLeavesReportService } from './hr-leaves-report.service';
import { HrVacationsReportService } from './hr-vacations-report.service';
import { ZootechnicalMetricsService } from './zootechnical-metrics.service';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/reports')
export class ReportsController {
  constructor(
    private readonly metrics: ZootechnicalMetricsService,
    private readonly stub: ReportsStubService,
    private readonly productionCost: ProductionCostReportService,
    private readonly eggStock: EggProductionStockService,
    private readonly financeTitles: FinanceTitlesReportService,
    private readonly receivableAging: ReceivableAgingReportService,
    private readonly cashReport: CashReportService,
    private readonly productionDailySvc: ProductionDailyReportService,
    private readonly productsReportSvc: ProductsReportService,
    private readonly stockMovementsReportSvc: StockMovementsReportService,
    private readonly stockReceiptsReportSvc: StockReceiptsReportService,
    private readonly purchaseOrdersReportSvc: PurchaseOrdersReportService,
    private readonly salesOrdersReportSvc: SalesOrdersReportService,
    private readonly hrEmployeesReportSvc: HrEmployeesReportService,
    private readonly hrLeavesReportSvc: HrLeavesReportService,
    private readonly hrVacationsReportSvc: HrVacationsReportService,
  ) {}

  @Get('receivable-aging')
  @RequirePermissions('reports.read', 'finance.write', '*')
  receivableAgingReport(@CurrentUser() user: JwtPayload) {
    return this.receivableAging.report(user);
  }

  @Get('dashboard/:flockLotId')
  @RequirePermissions('reports.read', 'production.read', '*')
  dashboard(@CurrentUser() user: JwtPayload, @Param('flockLotId') flockLotId: string) {
    return this.metrics.dashboard(user.tenantSlug, flockLotId);
  }

  @Get('cost-per-dozen/:flockLotId')
  @RequirePermissions('reports.read', '*')
  cost(@CurrentUser() user: JwtPayload, @Param('flockLotId') flockLotId: string) {
    return this.metrics.costPerDozen(user.tenantSlug, flockLotId);
  }

  @Get('egg-inventory')
  @RequirePermissions('reports.read', 'inventory.read', 'production.read', '*')
  eggInventory(@CurrentUser() user: JwtPayload) {
    return this.eggStock.inventorySnapshot(user.tenantSlug);
  }

  @Get('production-cost/:flockLotId')
  @RequirePermissions('reports.read', 'production.read', '*')
  productionCostReport(@CurrentUser() user: JwtPayload, @Param('flockLotId') flockLotId: string) {
    return this.productionCost.byLot(user.tenantSlug, flockLotId);
  }

  @Get('finance-titles')
  @RequirePermissions('reports.read', 'finance.write', '*')
  financeTitlesReport(
    @CurrentUser() user: JwtPayload,
    @Query('kind') kind?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
    @Query('partnerId') partnerId?: string,
    @Query('includeOpen') includeOpen?: string,
    @Query('includeSettled') includeSettled?: string,
    @Query('includePartialPayment') includePartialPayment?: string,
    @Query('includePartialOpen') includePartialOpen?: string,
  ) {
    if (kind !== 'payable' && kind !== 'receivable') {
      throw new BadRequestException('Parâmetro kind deve ser payable ou receivable');
    }
    const parseBool = (v: string | undefined) => {
      if (v === '0' || v === 'false') return false;
      if (v === '1' || v === 'true') return true;
      return undefined;
    };
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.financeTitles.report(user, {
      kind,
      from,
      to,
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
      partnerId: partnerId?.trim() || undefined,
      includeOpen: parseBool(includeOpen),
      includeSettled: parseBool(includeSettled),
      includePartialPayment: parseBool(includePartialPayment),
      includePartialOpen: parseBool(includePartialOpen),
    });
  }

  @Get('hr-vacations')
  @RequirePermissions('reports.read', 'hr.read', '*')
  hrVacationsReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('vacationId') vacationId?: string,
  ) {
    if (variant !== 'espelho' && variant !== 'listagem') {
      throw new BadRequestException('variant deve ser espelho ou listagem');
    }
    return this.hrVacationsReportSvc.report(user, {
      variant,
      from,
      to,
      jobTitle: jobTitle?.trim() || undefined,
      vacationId: vacationId?.trim() || undefined,
    });
  }

  @Get('hr-leaves')
  @RequirePermissions('reports.read', 'hr.read', '*')
  hrLeavesReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('leaveId') leaveId?: string,
  ) {
    if (variant !== 'espelho' && variant !== 'listagem') {
      throw new BadRequestException('variant deve ser espelho ou listagem');
    }
    return this.hrLeavesReportSvc.report(user, {
      variant,
      from,
      to,
      jobTitle: jobTitle?.trim() || undefined,
      leaveId: leaveId?.trim() || undefined,
    });
  }

  @Get('hr-employees')
  @RequirePermissions('reports.read', 'hr.read', '*')
  hrEmployeesReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('sort') sort?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
  ) {
    if (variant !== 'listagem_geral') {
      throw new BadRequestException('variant deve ser listagem_geral');
    }
    const sorts = ['controle', 'nome', 'salario_asc', 'salario_desc'] as const;
    if (!sort || !sorts.includes(sort as (typeof sorts)[number])) {
      throw new BadRequestException('sort inválido');
    }
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.hrEmployeesReportSvc.report(user, {
      variant: 'listagem_geral',
      sort: sort as (typeof sorts)[number],
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
    });
  }

  @Get('sales-orders')
  @RequirePermissions('reports.read', 'sales.read', '*')
  salesOrdersReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
    @Query('partnerId') partnerId?: string,
    @Query('productId') productId?: string,
    @Query('salesOrderId') salesOrderId?: string,
  ) {
    const variants = ['espelho', 'periodo', 'cliente', 'produtos'] as const;
    if (!variant || !variants.includes(variant as (typeof variants)[number])) {
      throw new BadRequestException('variant inválido');
    }
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.salesOrdersReportSvc.report(user, {
      variant: variant as (typeof variants)[number],
      from,
      to,
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
      partnerId: partnerId?.trim() || undefined,
      productId: productId?.trim() || undefined,
      salesOrderId: salesOrderId?.trim() || undefined,
    });
  }

  @Get('purchase-orders')
  @RequirePermissions('reports.read', 'purchasing.write', '*')
  purchaseOrdersReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    if (variant !== 'pedidos' && variant !== 'produtos_por_pedido') {
      throw new BadRequestException('variant deve ser pedidos ou produtos_por_pedido');
    }
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.purchaseOrdersReportSvc.report(user, {
      variant,
      from,
      to,
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
      partnerId: partnerId?.trim() || undefined,
    });
  }

  @Get('stock-receipts')
  @RequirePermissions('reports.read', 'inventory.read', '*')
  stockReceiptsReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
    @Query('partnerId') partnerId?: string,
  ) {
    if (variant !== 'notas' && variant !== 'produtos_por_nota') {
      throw new BadRequestException('variant deve ser notas ou produtos_por_nota');
    }
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.stockReceiptsReportSvc.report(user, {
      variant,
      from,
      to,
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
      partnerId: partnerId?.trim() || undefined,
    });
  }

  @Get('stock-movements')
  @RequirePermissions('reports.read', 'inventory.read', '*')
  stockMovementsReport(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
    @Query('chartAccountId') chartAccountId?: string,
    @Query('includeIn') includeIn?: string,
    @Query('includeOut') includeOut?: string,
    @Query('includeAdjust') includeAdjust?: string,
  ) {
    const parseBool = (v: string | undefined) => {
      if (v === '0' || v === 'false') return false;
      if (v === '1' || v === 'true') return true;
      return undefined;
    };
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.stockMovementsReportSvc.report(user, {
      from,
      to,
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
      chartAccountId: chartAccountId?.trim() || undefined,
      includeIn: parseBool(includeIn),
      includeOut: parseBool(includeOut),
      includeAdjust: parseBool(includeAdjust),
    });
  }

  @Get('products')
  @RequirePermissions('reports.read', 'inventory.read', '*')
  productsReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('stockLocationIds') stockLocationIds?: string,
  ) {
    const variants: ProductsReportVariant[] = [
      'geral',
      'saldo_fisico',
      'saldo_financeiro',
      'giro',
    ];
    if (!variant || !variants.includes(variant as ProductsReportVariant)) {
      throw new BadRequestException('variant inválido');
    }
    const ids = stockLocationIds
      ?.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.productsReportSvc.report(user, {
      variant: variant as ProductsReportVariant,
      from,
      to,
      stockLocationIds: ids?.length ? ids : undefined,
    });
  }

  @Get('production-daily')
  @RequirePermissions('reports.read', 'production.read', '*')
  productionDailyReport(
    @CurrentUser() user: JwtPayload,
    @Query('domain') domain?: string,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('flockLotId') flockLotId?: string,
  ) {
    const domains: ProductionReportDomain[] = [
      'postura',
      'mortalidade',
      'racao',
      'ambiente',
      'transferencia',
    ];
    const variants: ProductionReportVariant[] = ['geral', 'periodo', 'lote', 'totais'];
    if (!domain || !domains.includes(domain as ProductionReportDomain)) {
      throw new BadRequestException('domain inválido');
    }
    if (!variant || !variants.includes(variant as ProductionReportVariant)) {
      throw new BadRequestException('variant inválido');
    }
    return this.productionDailySvc.report(user, {
      domain: domain as ProductionReportDomain,
      variant: variant as ProductionReportVariant,
      from,
      to,
      flockLotId: flockLotId?.trim() || undefined,
    });
  }

  @Get('cash')
  @RequirePermissions('reports.read', 'cash.read', '*')
  cashRegisterReport(
    @CurrentUser() user: JwtPayload,
    @Query('variant') variant?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('date') date?: string,
    @Query('controlMin') controlMin?: string,
    @Query('controlMax') controlMax?: string,
  ) {
    if (variant !== 'controle' && variant !== 'periodo' && variant !== 'dia') {
      throw new BadRequestException('variant deve ser controle, periodo ou dia');
    }
    const parseIntOpt = (v: string | undefined) => {
      if (!v?.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    return this.cashReport.report(user, {
      variant,
      from,
      to,
      date,
      controlMin: parseIntOpt(controlMin),
      controlMax: parseIntOpt(controlMax),
    });
  }

  @Get('stub/:reportKey')
  @RequirePermissions('reports.read', '*')
  stubReport(
    @CurrentUser() user: JwtPayload,
    @Param('reportKey') reportKey: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('min') min?: string,
    @Query('max') max?: string,
  ) {
    return this.stub.generate(user, reportKey, { from, to, min, max });
  }
}
