import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../auth/jwt.strategy';

export function assertBarnAccess(user: JwtPayload, barnId: string) {
  if (!user.barnIds.length) return;
  if (!user.barnIds.includes(barnId)) {
    throw new ForbiddenException('Acesso negado a este galpão');
  }
}

export async function filterLotsByBarnScope<T extends { barnId: string }>(
  user: JwtPayload,
  items: T[],
): Promise<T[]> {
  if (!user.barnIds.length) return items;
  return items.filter((i) => user.barnIds.includes(i.barnId));
}
