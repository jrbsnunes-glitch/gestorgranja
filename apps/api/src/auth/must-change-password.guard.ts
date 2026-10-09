import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtPayload } from './jwt.strategy';
import { SKIP_MUST_CHANGE_PASSWORD_KEY } from './must-change-password.decorator';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_MUST_CHANGE_PASSWORD_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const req = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    if (req.user?.mustChangePassword) {
      throw new ForbiddenException({
        message: 'Defina uma nova senha para continuar.',
        code: 'MUST_CHANGE_PASSWORD',
      });
    }
    return true;
  }
}
