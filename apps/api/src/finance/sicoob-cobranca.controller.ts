import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Audited } from '../audit/audit.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../auth/jwt.strategy';
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { SicoobCobrancaService } from './sicoob-cobranca.service';

@ApiTags('finance-sicoob')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/finance')
export class SicoobCobrancaController {
  constructor(private readonly sicoob: SicoobCobrancaService) {}

  @Get('sicoob/settings')
  @RequirePermissions('finance.write', '*')
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.sicoob.getSettings(user);
  }

  @Patch('sicoob/settings')
  @RequirePermissions('finance.write', '*')
  @Audited('SicoobCobrancaSettings')
  patchSettings(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.sicoob.updateSettings(user, body as Parameters<SicoobCobrancaService['updateSettings']>[1]);
  }

  @Post('sicoob/certificate')
  @RequirePermissions('finance.write', '*')
  @Audited('SicoobCobrancaSettings')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 512 * 1024 } }))
  uploadCert(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('password') password: string,
  ) {
    return this.sicoob.uploadCertificate(user, file?.buffer ?? Buffer.alloc(0), password ?? '');
  }

  @Post('receivables/:id/boleto')
  @RequirePermissions('finance.write', '*')
  @Audited('BankBoleto')
  emitReceivable(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sicoob.emitForReceivable(user, id);
  }

  @Get('receivables/:id/boletos')
  @RequirePermissions('finance.write', '*')
  listReceivableBoletos(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sicoob.listForReceivable(user, id);
  }

  @Post('sales-orders/:id/boleto')
  @RequirePermissions('finance.write', 'sales.write', '*')
  @Audited('BankBoleto')
  emitSale(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sicoob.emitForSalesOrder(user, id);
  }

  @Get('boletos/:id')
  @RequirePermissions('finance.write', 'sales.read', '*')
  getBoleto(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sicoob.getBoleto(user, id);
  }

  @Post('boletos/:id/refresh')
  @RequirePermissions('finance.write', '*')
  refresh(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sicoob.refreshBoleto(user, id);
  }

  @Post('boletos/:id/baixa')
  @RequirePermissions('finance.write', '*')
  @Audited('BankBoleto')
  baixa(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.sicoob.baixarBoleto(user, id);
  }

  @Get('boletos/:id/pdf')
  @RequirePermissions('finance.write', 'sales.read', 'sales.write', '*')
  async pdf(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Res() res: Response) {
    const doc = await this.sicoob.getBoletoDocument(user, id);
    res.setHeader('Content-Type', doc.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${doc.filename}"`);
    res.send(doc.buffer);
  }
}
