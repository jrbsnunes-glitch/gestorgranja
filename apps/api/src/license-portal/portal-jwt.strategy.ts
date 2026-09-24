import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { LICENSE_PORTAL_JWT_AUD, type PortalJwtPayload } from './portal-jwt.types';

@Injectable()
export class PortalJwtStrategy extends PassportStrategy(Strategy, 'portal-jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
    });
  }

  validate(payload: PortalJwtPayload & { aud?: string }): PortalJwtPayload {
    if (payload.aud !== LICENSE_PORTAL_JWT_AUD) {
      throw new UnauthorizedException('Token inválido para o portal de licenças');
    }
    return payload as PortalJwtPayload;
  }
}
