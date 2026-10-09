import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from './jwt.strategy';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from './must-change-password.decorator';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = req.user;

    const skipPwd = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (user?.mustChangePassword && !skipPwd) {
      throw new ForbiddenException({
        message: 'Defina uma nova senha para continuar.',
        code: 'MUST_CHANGE_PASSWORD',
      });
    }

    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    if (!user?.permissions?.length) {
      throw new ForbiddenException('Sem permissões');
    }
    const isAdmin = user.permissions.includes('*');
    const allowed = isAdmin || required.some((p) => user.permissions.includes(p));
    if (!allowed) {
      throw new ForbiddenException(`Permissões necessárias (uma delas): ${required.filter((p) => p !== '*').join(', ') || required.join(', ')}`);
    }
    return true;
  }
}
