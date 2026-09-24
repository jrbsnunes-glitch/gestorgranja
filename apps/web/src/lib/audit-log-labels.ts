import { humanizeUserText } from '@/lib/humanize-user-text';

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

const AUDIT_ACTION_LABELS: Record<string, string> = {
  POST: 'Inclusão',
  GET: 'Consulta',
  PATCH: 'Alteração',
  PUT: 'Alteração',
  DELETE: 'Exclusão',
  CREATE: 'Inclusão',
  UPDATE: 'Alteração',
  REPORT: 'Relatório gerado',
};

const AUDIT_ENTITY_LABELS: Record<string, string> = {
  DailyEggProduction: 'Postura diária',
  DailyMortality: 'Mortalidade diária',
  DailyFeedConsumption: 'Consumo de ração',
  AccountPayable: 'Conta a pagar',
  AccountReceivable: 'Conta a receber',
  Accountpayable: 'Conta a pagar',
  Accountreceivable: 'Conta a receber',
  Dailyeggproduction: 'Postura diária',
  Dailymortality: 'Mortalidade diária',
  Dailyfeedconsumption: 'Consumo de ração',
  Produtos: 'Produtos e materiais',
  Product: 'Produto',
  'production.egg-stock.resync': 'Estoque de ovos — reprocessar produção',
  'Production.egg-stock.resync': 'Estoque de ovos — reprocessar produção',
  'production.egg-stock.apply-costs': 'Estoque de ovos — aplicar custos',
  'Production.egg-stock.apply-costs': 'Estoque de ovos — aplicar custos',
  'rh-ponto': 'Relatório — Ponto',
  'rh-folha': 'Relatório — Folha de pagamento',
  'rh-atestados': 'Relatório — Atestados',
  'rh-ferias': 'Relatório — Férias',
  'rh-funcionarios': 'Relatório — Funcionários',
  StockMovement: 'Movimentação de estoque',
  StockReceipt: 'Entrada de estoque (NF)',
  SalesOrder: 'Venda',
  Partner: 'Parceiro',
};

function formatDatePt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const day = raw.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const [y, m, d] = day.split('-');
  return `${d}/${m}/${y}`;
}

function asObject(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

export type AuditLogLike = {
  action: string;
  entity: string;
  entityId?: string | null;
  afterJson?: unknown;
  beforeJson?: unknown;
};

export function formatAuditAction(action: string): string {
  const key = action.trim();
  return AUDIT_ACTION_LABELS[key] ?? AUDIT_ACTION_LABELS[key.toUpperCase()] ?? humanizeUserText(key);
}

export function formatAuditEntity(entity: string): string {
  const key = entity.trim();
  if (AUDIT_ENTITY_LABELS[key]) return AUDIT_ENTITY_LABELS[key];
  const lower = key.toLowerCase();
  for (const [k, label] of Object.entries(AUDIT_ENTITY_LABELS)) {
    if (k.toLowerCase() === lower) return label;
  }
  if (key.includes('.')) {
    const parts = key.split('.').map((p) => formatAuditEntity(p));
    return parts.join(' — ');
  }
  return humanizeUserText(
    key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/^\w|\s\w/g, (c) => c.toUpperCase()),
  );
}

/** Texto legível no lugar do UUID na listagem. */
export function formatAuditReference(row: AuditLogLike): string {
  const payloads = [row.afterJson, row.beforeJson].map(asObject).filter(Boolean) as Record<
    string,
    unknown
  >[];

  for (const o of payloads) {
    if (typeof o.controlNumber === 'number') return `Controle nº ${o.controlNumber}`;
    if (typeof o.code === 'string' && o.code.trim()) return `Código ${o.code.trim()}`;
    if (typeof o.orderNumber === 'string' && o.orderNumber.trim()) return `Pedido ${o.orderNumber.trim()}`;
    if (typeof o.description === 'string' && o.description.trim()) {
      const t = o.description.trim();
      return t.length > 72 ? `${t.slice(0, 69)}…` : t;
    }
    if (typeof o.name === 'string' && o.name.trim()) return o.name.trim();
    if (typeof o.sku === 'string' && o.sku.trim()) return `Produto ${o.sku.trim()}`;
    if (typeof o.date === 'string') {
      const d = formatDatePt(o.date);
      if (d) return `Data ${d}`;
    }
    if (typeof o.reportKey === 'string') return formatAuditEntity(o.reportKey);
    if (typeof o.from === 'string' || typeof o.to === 'string') {
      const from = typeof o.from === 'string' ? formatDatePt(o.from) : null;
      const to = typeof o.to === 'string' ? formatDatePt(o.to) : null;
      if (from || to) return `Período ${from ?? '…'} a ${to ?? '…'}`;
    }
  }

  if (row.entityId && UUID_RE.test(row.entityId)) {
    return 'Registro do sistema (identificador interno oculto)';
  }
  if (row.entityId?.trim()) return humanizeUserText(row.entityId);

  return '—';
}

export function formatAuditSummary(row: AuditLogLike): string {
  const action = formatAuditAction(row.action);
  const entity = formatAuditEntity(row.entity);
  const ref = formatAuditReference(row);
  if (ref === '—') return `${action} — ${entity}`;
  return `${action} — ${entity}: ${ref}`;
}
