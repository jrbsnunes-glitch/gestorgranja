/** URL do menu Logs filtrado pelo histórico de um registro. */
export function auditTrailLogsHref(entity: string, entityId: string): string {
  const q = new URLSearchParams({ entity, entityId });
  return `/logs?${q.toString()}`;
}

export type AuditTrailRef = { entity: string; entityId: string };
