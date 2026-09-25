import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { HrReportsService } from './hr-reports.service';
import { HrSettingsService } from './hr-settings.service';
import { HrPayrollRubricsService } from './hr-payroll-rubrics.service';
import type { PayslipFieldsConfig } from './hr-payslip-fields';
import { HrPlanInterceptor } from './hr-plan.interceptor';
import { HrService } from './hr.service';

@ApiTags('hr')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@UseInterceptors(HrPlanInterceptor)
@Controller('v1/hr')
export class HrController {
  constructor(
    private readonly hr: HrService,
    private readonly reports: HrReportsService,
    private readonly hrSettings: HrSettingsService,
    private readonly payrollRubrics: HrPayrollRubricsService,
  ) {}

  @Get('employees')
  @RequirePermissions('hr.read', '*')
  employees(@CurrentUser() user: JwtPayload) {
    return this.hr.listEmployees(user);
  }

  @Get('users-for-link')
  @RequirePermissions('hr.read', 'admin.users', '*')
  usersForLink(@CurrentUser() user: JwtPayload) {
    return this.hr.listUsersForLink(user);
  }

  @Post('employees')
  @RequirePermissions('hr.write', '*')
  createEmployee(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.hr.createEmployee(user, body);
  }

  @Patch('employees/:id')
  @RequirePermissions('hr.write', '*')
  updateEmployee(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hr.updateEmployee(user, id, body);
  }

  @Delete('employees/:id')
  @RequirePermissions('hr.write', '*')
  deleteEmployee(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.deleteEmployee(user, id);
  }

  @Get('leaves')
  @RequirePermissions('hr.read', '*')
  leaves(@CurrentUser() user: JwtPayload) {
    return this.hr.listLeaves(user);
  }

  @Post('leaves')
  @RequirePermissions('hr.write', '*')
  createLeave(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.hr.createLeave(user, body);
  }

  @Patch('leaves/:id')
  @RequirePermissions('hr.write', '*')
  updateLeave(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hr.updateLeave(user, id, body);
  }

  @Delete('leaves/:id')
  @RequirePermissions('hr.write', '*')
  deleteLeave(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.deleteLeave(user, id);
  }

  @Get('vacations')
  @RequirePermissions('hr.read', '*')
  vacations(@CurrentUser() user: JwtPayload) {
    return this.hr.listVacations(user);
  }

  @Post('vacations')
  @RequirePermissions('hr.write', '*')
  createVacation(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.hr.createVacation(user, body);
  }

  @Patch('vacations/:id')
  @RequirePermissions('hr.write', '*')
  updateVacation(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hr.updateVacation(user, id, body);
  }

  @Delete('vacations/:id')
  @RequirePermissions('hr.write', '*')
  deleteVacation(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.deleteVacation(user, id);
  }

  @Get('settings')
  @RequirePermissions('hr.read', '*')
  hrSettingsGet(@CurrentUser() user: JwtPayload) {
    return this.hrSettings.get(user);
  }

  @Patch('settings')
  @RequirePermissions('hr.write', '*')
  hrSettingsPatch(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      productWithdrawalWarnPct?: number;
      requireWithdrawalPayrollAuth?: boolean;
      detailWithdrawalsOnPayslip?: boolean;
      payslipFields?: Partial<PayslipFieldsConfig>;
    },
  ) {
    return this.hrSettings.update(user, body);
  }

  @Get('payroll-rubrics')
  @RequirePermissions('hr.read', '*')
  listPayrollRubrics(@CurrentUser() user: JwtPayload) {
    return this.payrollRubrics.list(user);
  }

  @Patch('payroll-rubrics/:id')
  @RequirePermissions('hr.write', '*')
  patchPayrollRubric(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { description?: string },
  ) {
    return this.payrollRubrics.updateDescription(user, id, body.description ?? '');
  }

  @Patch('payroll/:id')
  @RequirePermissions('hr.write', '*')
  patchPayrollRun(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { paymentDate?: string | null },
  ) {
    return this.hr.updatePayrollRun(user, id, body);
  }

  @Get('withdrawals/warnings')
  @RequirePermissions('hr.read', '*')
  withdrawalWarnings(@CurrentUser() user: JwtPayload) {
    return this.hr.getWithdrawalWarnings(user);
  }

  @Get('withdrawals')
  @RequirePermissions('hr.read', '*')
  withdrawals(@CurrentUser() user: JwtPayload) {
    return this.hr.listWithdrawals(user);
  }

  @Post('withdrawals')
  @RequirePermissions('hr.write', '*')
  createWithdrawal(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.hr.createWithdrawal(user, body);
  }

  @Patch('withdrawals/:id')
  @RequirePermissions('hr.write', '*')
  updateWithdrawal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.hr.updateWithdrawal(user, id, body);
  }

  @Delete('withdrawals/:id')
  @RequirePermissions('hr.write', '*')
  deleteWithdrawal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.deleteWithdrawal(user, id);
  }

  @Get('payroll')
  @RequirePermissions('hr.read', '*')
  payroll(@CurrentUser() user: JwtPayload) {
    return this.hr.listPayrollRuns(user);
  }

  @Post('payroll')
  @RequirePermissions('hr.write', '*')
  createPayroll(@CurrentUser() user: JwtPayload, @Body() body: { yearMonth: string }) {
    return this.hr.createPayrollRun(user, body.yearMonth);
  }

  @Patch('payroll/:id/close')
  @RequirePermissions('hr.write', '*')
  closePayroll(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.closePayrollRun(user, id);
  }

  @Post('payroll/:id/apply-withdrawals')
  @RequirePermissions('hr.write', '*')
  applyWithdrawals(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.syncPayrollWithdrawals(user, id);
  }

  @Post('payroll/:id/sync-taxes')
  @RequirePermissions('hr.write', '*')
  syncPayrollTaxes(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.syncPayrollTaxes(user, id);
  }

  @Patch('payroll/lines/:lineId')
  @RequirePermissions('hr.write', '*')
  patchLine(
    @CurrentUser() user: JwtPayload,
    @Param('lineId') lineId: string,
    @Body()
    body: {
      additions?: number;
      deductions?: number;
      otHours50?: number;
      otHours100?: number;
      commissionAmount?: number;
      ajudaCustoAmount?: number;
      recalculate?: boolean;
    },
  ) {
    return this.hr.updatePayrollLine(user, lineId, body);
  }

  @Get('reports/punches')
  @RequirePermissions('hr.read', '*')
  reportPunches(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.reports.punchMirrorDocument(user, from, to);
  }

  @Get('time/terminals/:id/kiosk-config')
  @RequirePermissions('hr.read', '*')
  terminalKioskConfig(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.getTerminalKioskConfig(user, id);
  }

  @Get('reports/payroll/:runId')
  @RequirePermissions('hr.read', '*')
  reportPayroll(@CurrentUser() user: JwtPayload, @Param('runId') runId: string) {
    return this.reports.payrollReport(user, runId);
  }

  @Get('reports/payroll/:runId/print')
  @RequirePermissions('hr.read', '*')
  reportPayrollPrint(@CurrentUser() user: JwtPayload, @Param('runId') runId: string) {
    return this.reports.payrollPrintDocument(user, runId);
  }

  @Get('time/terminals')
  @RequirePermissions('hr.read', '*')
  terminals(@CurrentUser() user: JwtPayload) {
    return this.hr.listTerminals(user);
  }

  @Post('time/terminals')
  @RequirePermissions('hr.write', '*')
  createTerminal(@CurrentUser() user: JwtPayload, @Body() body: { name: string }) {
    return this.hr.createTerminal(user, body.name);
  }

  @Patch('time/terminals/:id')
  @RequirePermissions('hr.write', '*')
  updateTerminal(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; isActive?: boolean },
  ) {
    return this.hr.updateTerminal(user, id, body);
  }

  @Delete('time/terminals/:id')
  @RequirePermissions('hr.write', '*')
  deleteTerminal(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.deleteTerminal(user, id);
  }

  @Post('time/terminals/:id/qr')
  @RequirePermissions('hr.read', '*')
  qr(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.hr.refreshTerminalQr(user, id);
  }

  @Post('time/punch')
  @RequirePermissions('hr.read', '*')
  punch(
    @CurrentUser() user: JwtPayload,
    @Body() body: { token: string; terminalId: string; source: 'KIOSK' | 'MOBILE' },
  ) {
    return this.hr.punch(user, body);
  }

  @Get('time/punches')
  @RequirePermissions('hr.read', '*')
  punches(@CurrentUser() user: JwtPayload) {
    return this.hr.listPunches(user);
  }
}
