export const DEFAULT_PERMISSIONS = [
  { code: '*', module: 'all', action: 'all' },
  { code: 'production.read', module: 'production', action: 'read' },
  { code: 'production.write', module: 'production', action: 'write' },
  /** Conferir registros operacionais (marcar como conferido). */
  { code: 'production.review', module: 'production', action: 'review' },
  /** Ajustes autorizados (movimentação de aves ADJUST/CLOSE, correção de registro conferido). */
  { code: 'production.adjust', module: 'production', action: 'adjust' },
  /** Registrar e tratar ocorrências operacionais. */
  { code: 'occurrences.write', module: 'occurrences', action: 'write' },
  /** Alterar parâmetros e padrões da operação (limites de alerta, integração de estoque). */
  { code: 'operation.settings', module: 'operation', action: 'settings' },
  { code: 'nutrition.write', module: 'nutrition', action: 'write' },
  { code: 'health.write', module: 'health', action: 'write' },
  { code: 'inventory.write', module: 'inventory', action: 'write' },
  { code: 'purchasing.write', module: 'purchasing', action: 'write' },
  { code: 'finance.write', module: 'finance', action: 'write' },
  { code: 'reports.read', module: 'reports', action: 'read' },
  { code: 'sync.write', module: 'sync', action: 'write' },
  { code: 'admin.users', module: 'admin', action: 'users' },
  { code: 'cadastros.read', module: 'cadastros', action: 'read' },
  { code: 'cadastros.write', module: 'cadastros', action: 'write' },
  { code: 'hr.read', module: 'hr', action: 'read' },
  { code: 'hr.write', module: 'hr', action: 'write' },
  { code: 'sales.read', module: 'sales', action: 'read' },
  { code: 'sales.write', module: 'sales', action: 'write' },
  { code: 'cash.read', module: 'cash', action: 'read' },
  { code: 'cash.write', module: 'cash', action: 'write' },
  { code: 'cash.reconcile', module: 'cash', action: 'reconcile' },
] as const;

export const DEFAULT_ROLES = [
  { name: 'admin', permissions: ['*'] },
  {
    name: 'gestor_producao',
    permissions: [
      'production.read',
      'production.write',
      'production.review',
      'production.adjust',
      'occurrences.write',
      'operation.settings',
      'nutrition.write',
      'health.write',
      'reports.read',
    ],
  },
  {
    name: 'operador_campo',
    permissions: [
      'production.read',
      'production.write',
      'occurrences.write',
      'nutrition.write',
      'sync.write',
      'hr.read',
    ],
  },
  /** Funcionário de granja: postura + batida de ponto (sem cadastros RH). */
  {
    name: 'funcionario',
    permissions: ['production.read', 'production.write', 'sync.write', 'hr.read'],
  },
  {
    name: 'financeiro',
    permissions: ['finance.write', 'inventory.write', 'purchasing.write', 'reports.read', 'sales.write', 'cash.write'],
  },
  {
    name: 'rh',
    permissions: ['hr.read', 'hr.write', 'reports.read'],
  },
] as const;
