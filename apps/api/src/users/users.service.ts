import { BadRequestException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { assertValidUsername, usernameFromEmail } from './username.util';

@Injectable()
export class UsersService {
  constructor(private readonly tenantPrisma: TenantPrismaService) {}

  async list(user: JwtPayload) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        roleAssignments: { include: { role: true, barn: true } },
      },
    });
  }

  async assignRole(user: JwtPayload, data: { userId: string; roleName: string; barnId?: string }) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: data.roleName } });
    return prisma.userRoleAssignment.create({
      data: {
        userId: data.userId,
        roleId: role.id,
        barnId: data.barnId,
      },
    });
  }

  async updateUser(
    user: JwtPayload,
    id: string,
    data: {
      name?: string;
      isActive?: boolean;
      email?: string;
      username?: string;
      password?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) throw new BadRequestException('Usuário não encontrado');

    const patch: {
      name?: string;
      isActive?: boolean;
      email?: string;
      username?: string;
      passwordHash?: string;
    } = {};

    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.isActive !== undefined) patch.isActive = data.isActive;

    if (data.email !== undefined) {
      const email = data.email.trim().toLowerCase();
      if (!email.includes('@')) throw new BadRequestException('E-mail inválido');
      if (email !== existing.email) {
        const taken = await prisma.user.findFirst({ where: { email, NOT: { id } } });
        if (taken) throw new BadRequestException('E-mail já em uso por outro usuário');
        patch.email = email;
      }
    }

    if (data.username !== undefined && data.username.trim()) {
      let username: string;
      try {
        username = assertValidUsername(data.username);
      } catch (e) {
        throw new BadRequestException(e instanceof Error ? e.message : 'Usuário inválido');
      }
      if (username !== existing.username) {
        const taken = await prisma.user.findFirst({ where: { username, NOT: { id } } });
        if (taken) throw new BadRequestException('Usuário de login já em uso');
        patch.username = username;
      }
    }

    const newPassword = data.password?.trim();
    if (newPassword) {
      if (newPassword.length < 6) {
        throw new BadRequestException('Senha deve ter no mínimo 6 caracteres');
      }
      patch.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    if (!Object.keys(patch).length) {
      return existing;
    }

    return prisma.user.update({
      where: { id },
      data: patch,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        isActive: true,
        roleAssignments: { include: { role: true, barn: true } },
      },
    });
  }

  async createUser(
    user: JwtPayload,
    data: {
      email: string;
      username?: string;
      name: string;
      password: string;
      roleName: string;
      barnId?: string;
    },
  ) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    const role = await prisma.role.findUniqueOrThrow({ where: { name: data.roleName } });
    const hash = await bcrypt.hash(data.password, 10);
    const email = data.email.toLowerCase();
    const username = data.username?.trim()
      ? assertValidUsername(data.username)
      : usernameFromEmail(email);
    return prisma.user.create({
      data: {
        username,
        email,
        name: data.name,
        passwordHash: hash,
        roleAssignments: { create: { roleId: role.id, barnId: data.barnId } },
      },
    });
  }
}
