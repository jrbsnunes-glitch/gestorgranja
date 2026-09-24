import { Injectable } from '@nestjs/common';
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

  async updateUser(user: JwtPayload, id: string, data: { name?: string; isActive?: boolean }) {
    const prisma = await this.tenantPrisma.getClient(user.tenantSlug);
    return prisma.user.update({
      where: { id },
      data: { name: data.name?.trim(), isActive: data.isActive },
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
