import { Body, Controller, Param, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { HrService } from './hr.service';

@ApiTags('hr-public')
@Controller('v1/public/:tenantSlug/hr/time')
export class HrTimeKioskPublicController {
  constructor(private readonly hr: HrService) {}

  /** Renova QR do terminal (quiosque sem login — exige segredo do dispositivo). */
  @Post('terminals/:terminalId/qr')
  kioskQr(
    @Param('tenantSlug') tenantSlug: string,
    @Param('terminalId') terminalId: string,
    @Body() body: { deviceSecret?: string },
  ) {
    const secret = body.deviceSecret?.trim();
    if (!secret) throw new UnauthorizedException('Segredo do terminal inválido');
    return this.hr.refreshTerminalQrPublic(tenantSlug, terminalId, secret);
  }
}
