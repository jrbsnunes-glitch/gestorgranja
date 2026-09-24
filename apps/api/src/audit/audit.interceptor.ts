import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { JwtPayload } from '../auth/jwt.strategy';
import { AUDIT_ENTITY_KEY } from './audit.decorator';
import { AuditService } from './audit.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const entity = this.reflector.getAllAndOverride<string>(AUDIT_ENTITY_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!entity) return next.handle();

    const req = context.switchToHttp().getRequest<{
      user?: JwtPayload;
      method?: string;
      ip?: string;
    }>();
    const user = req.user;
    if (!user?.tenantSlug) return next.handle();

    return next.handle().pipe(
      tap((body) => {
        void this.audit.log({
          tenantSlug: user.tenantSlug,
          userId: user.sub,
          action: req.method ?? 'UNKNOWN',
          entity,
          entityId: typeof body === 'object' && body && 'id' in body ? String((body as { id: string }).id) : undefined,
          after: body,
          ip: req.ip,
        });
      }),
    );
  }
}
