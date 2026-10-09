import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { TenantService } from '../tenant/tenant.service';
import { normalizeUsername } from '../users/username.util';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './jwt.strategy';

type UserWithRoles = {
  id: string;
  username: string;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  mustChangePassword: boolean;
  roleAssignments: {
    barnId: string | null;
    role: {
      name: string;
      permissions: { permission: { code: string } }[];
    };
  }[];
};

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantPrisma: TenantPrismaService,
    private readonly tenantService: TenantService,
    private readonly jwt: JwtService,
  ) {}

  private buildPayload(user: UserWithRoles, tenantSlug: string): JwtPayload {
    const permissions = new Set<string>();
    const roles = new Set<string>();
    const barnIds = new Set<string>();
    for (const a of user.roleAssignments) {
      roles.add(a.role.name);
      if (a.barnId) barnIds.add(a.barnId);
      for (const rp of a.role.permissions) {
        permissions.add(rp.permission.code);
      }
    }

    return {
      sub: user.id,
      username: user.username,
      name: user.name?.trim() ?? '',
      email: user.email,
      tenantSlug,
      permissions: [...permissions],
      roles: [...roles],
      barnIds: [...barnIds],
      mustChangePassword: user.mustChangePassword,
    };
  }

  private signSession(user: UserWithRoles, tenantSlug: string) {
    const payload = this.buildPayload(user, tenantSlug);
    return {
      accessToken: this.jwt.sign(payload),
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        permissions: payload.permissions,
        roles: payload.roles,
        barnIds: payload.barnIds,
        mustChangePassword: user.mustChangePassword,
      },
    };
  }

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
    if (!user) throw new UnauthorizedException('Credenciais inválidas');
    if (!user.isActive) {
      throw new UnauthorizedException('Usuário inativo. Contate o administrador do sistema.');
    }

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Credenciais inválidas');

    return this.signSession(user, dto.tenantSlug);
  }

  async changePassword(actor: JwtPayload, dto: ChangePasswordDto) {
    const prisma = await this.tenantPrisma.getClient(actor.tenantSlug);
    const user = await prisma.user.findUnique({
      where: { id: actor.sub },
      include: {
        roleAssignments: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });
    if (!user?.isActive) throw new UnauthorizedException('Usuário inativo');

    const currentOk = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!currentOk) throw new BadRequestException('Senha atual incorreta');

    const newPassword = dto.newPassword.trim();
    if (newPassword.length < 6) {
      throw new BadRequestException('Nova senha deve ter no mínimo 6 caracteres');
    }
    if (await bcrypt.compare(newPassword, user.passwordHash)) {
      throw new BadRequestException('A nova senha deve ser diferente da senha atual');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false },
      include: {
        roleAssignments: {
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
          },
        },
      },
    });

    return this.signSession(updated, actor.tenantSlug);
  }
}
