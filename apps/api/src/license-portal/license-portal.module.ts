import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ProvisioningModule } from '../provisioning/provisioning.module';
import { LicensePortalController } from './license-portal.controller';
import { LicensePortalService } from './license-portal.service';
import { PortalJwtStrategy } from './portal-jwt.strategy';

@Module({
  imports: [
    ProvisioningModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
        signOptions: {
          expiresIn: '4h' as const,
        },
      }),
    }),
  ],
  controllers: [LicensePortalController],
  providers: [LicensePortalService, PortalJwtStrategy],
})
export class LicensePortalModule {}
