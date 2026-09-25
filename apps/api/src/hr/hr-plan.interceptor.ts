import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, switchMap } from 'rxjs';
import { JwtPayload } from '../auth/jwt.strategy';
import { TenantService } from '../tenant/tenant.service';

@Injectable()
export class HrPlanInterceptor implements NestInterceptor {
  constructor(private readonly tenant: TenantService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: JwtPayload; path?: string; url?: string }>();
    const user = req.user;
    if (!user?.tenantSlug) {
      return next.handle();
    }
    const path = `${req.path ?? ''}${req.url ?? ''}`;
    const checks: Promise<void>[] = [];
    if (this.needsPayroll(path)) {
      checks.push(this.tenant.assertPlanPayroll(user.tenantSlug));
    }
    if (this.needsTimeClock(path)) {
      checks.push(this.tenant.assertPlanTimeClock(user.tenantSlug));
    }
    if (checks.length === 0) {
      return next.handle();
    }
    return from(Promise.all(checks)).pipe(switchMap(() => next.handle()));
  }

  private needsPayroll(path: string): boolean {
    return (
      /\/payroll(\/|$|\?)/.test(path) ||
      /\/withdrawals(\/|$|\?)/.test(path) ||
      /payroll-rubrics/.test(path) ||
      /reports\/payroll/.test(path) ||
      /reports\/punches/.test(path)
    );
  }

  private needsTimeClock(path: string): boolean {
    return /\/time(\/|$|\?)/.test(path);
  }
}
