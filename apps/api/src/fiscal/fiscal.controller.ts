import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
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
import { RequirePermissions } from '../auth/permissions.decorator';
import { PermissionsGuard } from '../auth/permissions.guard';
import { CurrentUser } from '../auth/tenant.decorator';
import { JwtPayload } from '../auth/jwt.strategy';
import { FiscalService } from './fiscal.service';

@ApiTags('fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('v1/fiscal')
export class FiscalController {
  constructor(private readonly fiscal: FiscalService) {}

  @Get('issuer-settings')
  @RequirePermissions('fiscal.read', 'fiscal.write', 'cadastros.read', 'cadastros.write', '*')
  getSettings(@CurrentUser() user: JwtPayload) {
    return this.fiscal.getIssuerSettings(user);
  }

  @Patch('issuer-settings')
  @Audited('fiscal.settings.update')
  @RequirePermissions('fiscal.write', '*')
  patchSettings(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.fiscal.updateIssuerSettings(user, body as Parameters<FiscalService['updateIssuerSettings']>[1]);
  }

  @Post('certificate')
  @Audited('fiscal.certificate.upload')
  @RequirePermissions('fiscal.write', '*')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 512 * 1024 },
    }),
  )
  uploadCert(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body('password') password: string,
  ) {
    return this.fiscal.uploadCertificate(user, file?.buffer ?? Buffer.alloc(0), password ?? '');
  }

  @Post('test-sefaz')
  @RequirePermissions('fiscal.write', '*')
  testSefaz(@CurrentUser() user: JwtPayload) {
    return this.fiscal.testSefaz(user);
  }

  @Post('homolog-test-emit')
  @Audited('fiscal.homolog-test-emit')
  @RequirePermissions('fiscal.emit', 'fiscal.write', '*')
  homologTestEmit(
    @CurrentUser() user: JwtPayload,
    @Query('type') type?: 'NFE' | 'NFCE',
  ) {
    const docType = type === 'NFE' ? 'NFE' : 'NFCE';
    return this.fiscal.emitHomologationTest(user, docType);
  }

  @Post('manual-nfe/preview')
  @RequirePermissions('fiscal.emit', 'fiscal.write', '*')
  previewManualNfe(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.fiscal.previewManualNfe(user, body as import('./manual-nfe.types').ManualNfeInput);
  }

  @Post('manual-nfe')
  @Audited('fiscal.manual-nfe')
  @RequirePermissions('fiscal.emit', 'fiscal.write', '*')
  manualNfe(@CurrentUser() user: JwtPayload, @Body() body: Record<string, unknown>) {
    return this.fiscal.createManualNfe(user, body as import('./manual-nfe.types').ManualNfeInput);
  }

  @Post('documents/:id/send')
  @Audited('fiscal.send')
  @RequirePermissions('fiscal.emit', '*')
  sendDocument(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.fiscal.sendDraftDocument(user, id);
  }

  @Get('documents/:id/manual-nfe')
  @RequirePermissions('fiscal.read', 'fiscal.emit', 'fiscal.write', '*')
  getManualNfeDraft(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.fiscal.getManualNfeDraft(user, id);
  }

  @Patch('documents/:id/manual-nfe')
  @Audited('fiscal.manual-nfe.update')
  @RequirePermissions('fiscal.emit', 'fiscal.write', '*')
  updateManualNfe(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.fiscal.updateManualNfe(user, id, body as import('./manual-nfe.types').ManualNfeInput);
  }

  @Get('documents')
  @RequirePermissions('fiscal.read', 'fiscal.emit', 'sales.read', '*')
  listDocs(@CurrentUser() user: JwtPayload) {
    return this.fiscal.listDocuments(user);
  }

  @Get('documents/:id/xml')
  @RequirePermissions('fiscal.read', 'fiscal.emit', '*')
  async docXml(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Res() res: Response) {
    const { buf, mime } = await this.fiscal.getDocumentFile(user, id, 'xml');
    res.setHeader('Content-Type', mime);
    res.send(buf);
  }

  @Get('documents/:id/danfe')
  @RequirePermissions('fiscal.read', 'fiscal.emit', 'sales.read', '*')
  async docDanfe(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Res() res: Response) {
    const { buf, mime } = await this.fiscal.getDocumentFile(user, id, 'danfe');
    res.setHeader('Content-Type', mime);
    res.send(buf);
  }

  @Post('documents/:id/consult')
  @RequirePermissions('fiscal.read', 'fiscal.emit', '*')
  consultDocument(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.fiscal.consultDocument(user, id);
  }

  @Delete('documents/:id')
  @Audited('fiscal.document.delete')
  @RequirePermissions('fiscal.emit', 'fiscal.write', '*')
  deleteDocument(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.fiscal.deleteDocument(user, id);
  }

  @Post('emit/:salesOrderId')
  @Audited('fiscal.emit')
  @RequirePermissions('fiscal.emit', 'sales.write', '*')
  emit(
    @CurrentUser() user: JwtPayload,
    @Param('salesOrderId') salesOrderId: string,
    @Query('type') type?: 'NFE' | 'NFCE',
  ) {
    const docType = type === 'NFE' ? 'NFE' : 'NFCE';
    return this.fiscal.queueEmission(user, salesOrderId, docType);
  }

  @Post('documents/:id/cancel')
  @Audited('fiscal.cancel')
  @RequirePermissions('fiscal.emit', '*')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { reason: string }) {
    return this.fiscal.cancel(user, id, body.reason ?? '');
  }

  @Post('documents/:id/cce')
  @Audited('fiscal.cce')
  @RequirePermissions('fiscal.emit', '*')
  cce(@CurrentUser() user: JwtPayload, @Param('id') id: string, @Body() body: { text: string }) {
    return this.fiscal.cce(user, id, body.text ?? '');
  }

  @Post('inutilize')
  @Audited('fiscal.inutilize')
  @RequirePermissions('fiscal.emit', '*')
  inutilize(
    @CurrentUser() user: JwtPayload,
    @Body()
    body: { model: '55' | '65'; series: number; numberFrom: number; numberTo: number; reason: string },
  ) {
    return this.fiscal.inutilize(user, body);
  }
}
