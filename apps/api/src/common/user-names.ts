import type { PrismaClient } from '../generated/tenant-client';

export type UserNameMap = Map<string, { id: string; name: string; username: string }>;

/** Resolve nomes de usuários a partir de ids (campos *UserId sem FK). */
export async function loadUserNames(
  prisma: PrismaClient,
  ids: Array<string | null | undefined>,
): Promise<UserNameMap> {
  const unique = [...new Set(ids.filter((v): v is string => !!v))];
  if (!unique.length) return new Map();
  const rows = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, username: true },
  });
  return new Map(rows.map((r) => [r.id, r]));
}

export function userLabel(map: UserNameMap, id: string | null | undefined): string | null {
  if (!id) return null;
  const u = map.get(id);
  if (!u) return null;
  return u.name?.trim() || u.username;
}
