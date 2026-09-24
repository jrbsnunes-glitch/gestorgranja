import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { normalizeUsername } from '../users/username.util';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantService: TenantService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    await this.tenantService.assertLicenseActive(dto.tenantSlug);
    const prisma = await this.tenantPrisma.getClient(dto.tenantSlug);
    const username = normalizeUsername(dto.username);
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        roleAssignments: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user?.isActive) throw new UnauthorizedException('Credenciais inválidas');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    const permissions = new Set<string>();
    const barnIds = new Set<string>();
    for (const a of user.roleAssignments) {
      if (a.barnId) barnIds.add(a.barnId);
      for (const rp of a.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      tenantSlug: dto.tenantSlug,
      permissions: [...permissions],
      barnIds: [...barnIds],
    };

    return {
      accessToken: this.jwt.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        permissions: payload.permissions,
        barnIds: payload.barnIds,
      },
    };
  }
}
