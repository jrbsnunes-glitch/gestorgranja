import { humanizeUserText } from '@/lib/humanize-user-text';

/** Legendas em português para códigos/enums exibidos na interface. */

const ENUM_LABELS: Record<string, string> = {
  // Alertas
  LICENSE_EXPIRY: 'Validade de licença',
  WITHDRAWAL_PERIOD: 'Carência de retirada',
  LOW_STOCK: 'Estoque baixo',
  PAYMENT_DUE: 'Conta a pagar a vencer',
  SYNC_CONFLICT: 'Conflito de sincronização',
  RECEIVABLE_OVERDUE: 'Conta a receber atrasada',
  CASH_PROJECTION_BELOW_LIMIT: 'Caixa abaixo do limite',
  BUDGET_PACE_WARNING: 'Orçamento — ritmo elevado',
  PURCHASE_CASH_IMPACT: 'Impacto de compra no caixa',
  OPEN: 'Aberto',
  ACKNOWLEDGED: 'Reconhecido',
  RESOLVED: 'Resolvido',

  // Financeiro — títulos
  PENDING: 'Pendente',
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
  PAID: 'Pago',

  // Compras
  DRAFT: 'Rascunho',
  QUOTING: 'Em cotação',
  ORDERED: 'Pedido gerado',
  RECEIVED: 'Recebido',
  CANCELLED: 'Cancelado',

  // Vendas
  CONFIRMED: 'Confirmado',

  // Pagamento (vendas / caixa)
  CASH: 'Dinheiro',
  PIX: 'PIX',
  CARD: 'Cartão',
  TRANSFER: 'Transferência',

  // Caixa
  PENDING_RECONCILIATION: 'Aguardando conciliação',
  RECONCILED: 'Conciliado',
  CLOSED: 'Fechado',

  // Folha / RH
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluído',
  PLANNED: 'Planejado',
  APPLIED: 'Aplicado na folha',

  // Lotes
  ACTIVE: 'Ativo',
  FINISHED: 'Encerrado',

  // Movimentação de aves
  ENTRY: 'Entrada',
  TRANSFER_IN: 'Transferência (entrada)',
  TRANSFER_OUT: 'Transferência (saída)',
  EXIT: 'Saída',
  CLOSE: 'Encerramento do lote',

  // Galpão — situação
  IN_PRODUCTION: 'Em produção',
  EMPTY: 'Vazio',
  CLEANING: 'Limpeza / vazio sanitário',
  MAINTENANCE: 'Em manutenção',

  // Registros operacionais — conferência
  RECORDED: 'Registrado',
  REVIEWED: 'Conferido',
  ADJUSTED: 'Ajustado',

  // Alertas operacionais
  PRODUCTION_BELOW_STANDARD: 'Postura abaixo do padrão',
  FEED_VARIATION: 'Variação no consumo de ração',
  PENDING_RECORDS: 'Lançamento diário pendente',
  OPEN_OCCURRENCE: 'Ocorrência sem tratamento',
  LOSS_ABOVE_LIMIT: 'Perdas acima do limite',
  MORTALITY_ABOVE_LIMIT: 'Mortalidade acima do limite',

  // Ocorrências — tipo
  EQUIPMENT: 'Equipamento',
  WATER: 'Água (falta/interrupção)',
  POWER: 'Energia elétrica',
  ROUTINE: 'Alteração de rotina',
  ENVIRONMENT: 'Ambiente (temperatura/ventilação)',
  LOSS_INCREASE: 'Aumento de perdas',
  PRODUCTION_ANOMALY: 'Anormalidade na produção',
  SANITARY: 'Ocorrência sanitária',

  // Ocorrências — prioridade
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',

  // Insumos — tipo de movimentação
  CONSUMPTION: 'Consumo',
  LOSS: 'Perda',
  RETURN: 'Devolução',

  // Perdas — tipo
  EGG: 'Ovos',
  BIRD: 'Aves',

  // Produtos
  PACKAGED_EGG: 'Ovo embalado',
  FEED: 'Ração',
  MEDICATION: 'Medicamento',
  SUPPLY: 'Insumo',
  CONSTRUCTION: 'Obra',
  OFFICE: 'Escritório',
  VACCINE: 'Vacina',
  OTHER: 'Outro',

  // Sync (campo)
  dailyEggProduction: 'Postura diária',
  dailyMortality: 'Mortalidade diária',
  dailyFeedConsumption: 'Consumo de ração',

  // Estoque
  ADJUST: 'Ajuste',
  NFE_KEY: 'Chave NF-e',
  MANUAL: 'Manual',

  // Casca / lote
  WHITE: 'Branco',
  BROWN: 'Vermelho',
  MIXED: 'Misto',

  // Mortalidade
  UNKNOWN: 'Não informado',
  DISEASE: 'Doença',
  HEAT_STRESS: 'Estresse térmico',
  PREDATOR: 'Predador',

  // Ambiente
  WEBHOOK: 'Integração (webhook)',
  MQTT: 'Sensores (MQTT)',

  // Ponto eletrônico
  KIOSK: 'Terminal',
  MOBILE: 'Celular (QR)',

  // Parceiro
  PF: 'Pessoa física',
  PJ: 'Pessoa jurídica',

  // Atestados
  MEDICAL: 'Atestado médico',

  // Folha — itens
  EARNING: 'Provento',
  DEDUCTION: 'Desconto',

  // Plano de contas
  ASSET: 'Ativo',
  LIABILITY: 'Passivo',
  EQUITY: 'Patrimônio líquido',
  REVENUE: 'Receita',
  EXPENSE: 'Despesa',

  // Movimentos (estoque, caixa, ponto)
  IN: 'Entrada',
  OUT: 'Saída',

  // Auditoria (método HTTP / ação)
  POST: 'Inclusão',
  GET: 'Consulta',
  PATCH: 'Alteração',
  PUT: 'Alteração',
  DELETE: 'Exclusão',
  CREATE: 'Inclusão',
  UPDATE: 'Alteração',
  REPORT: 'Relatório gerado',

  // Gráficos / séries
  projectedBalance: 'Saldo projetado',

  // Postura diária (campos técnicos)
  extra: 'Extra',
  large: 'Grande',
  medium: 'Médio',
  small: 'Pequeno',
  cracked: 'Trincados',
  dirty: 'Sujos',
  deformed: 'Deformados',
  discard: 'Descarte',
};

/** Campos de classificação de ovos na postura diária. */
export const EGG_PRODUCTION_FIELDS = [
  'extra',
  'large',
  'medium',
  'small',
  'cracked',
  'dirty',
  'deformed',
  'discard',
] as const;

export type EggProductionField = (typeof EGG_PRODUCTION_FIELDS)[number];

export const MORTALITY_CAUSES = ['UNKNOWN', 'DISEASE', 'HEAT_STRESS', 'PREDATOR', 'OTHER'] as const;

export const BARN_SITUATIONS = ['IN_PRODUCTION', 'EMPTY', 'CLEANING', 'MAINTENANCE'] as const;

export const FLOCK_MOVEMENT_TYPES = ['ENTRY', 'TRANSFER_IN', 'TRANSFER_OUT', 'EXIT', 'ADJUST', 'CLOSE'] as const;

export type OperationRecordStatus = 'PENDING' | 'RECORDED' | 'REVIEWED' | 'ADJUSTED';

export const OCCURRENCE_TYPES = [
  'EQUIPMENT',
  'WATER',
  'POWER',
  'ROUTINE',
  'ENVIRONMENT',
  'LOSS_INCREASE',
  'PRODUCTION_ANOMALY',
  'SANITARY',
  'OTHER',
] as const;
export const OCCURRENCE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const OCCURRENCE_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'] as const;
export const SUPPLY_MOVEMENT_KINDS = ['CONSUMPTION', 'LOSS', 'ADJUST', 'TRANSFER', 'RETURN'] as const;
export const OPERATIONAL_LOSS_TYPES = ['EGG', 'FEED', 'SUPPLY', 'BIRD', 'EQUIPMENT', 'OTHER'] as const;

/** Registro conferido/ajustado só pode ser alterado com justificativa e permissão de ajuste. */
export function isRecordLocked(status: string | null | undefined): boolean {
  return status === 'REVIEWED' || status === 'ADJUSTED';
}

export function labelEggProductionField(field: EggProductionField | string): string {
  return labelEnum(field);
}

export const PRODUCT_TYPES = [
  'FEED',
  'MEDICATION',
  'SUPPLY',
  'CONSTRUCTION',
  'OFFICE',
  'PACKAGED_EGG',
] as const;

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  gestor_producao: 'Gestor de produção',
  operador_campo: 'Operador de campo',
  funcionario: 'Funcionário (produção e ponto)',
  financeiro: 'Financeiro',
  rh: 'Recursos humanos',
};

export const SYSTEM_ROLE_OPTIONS = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }));

/** Perfis RBAC (slug interno → nome exibido). */
export function labelRole(roleName: string | null | undefined): string {
  if (!roleName) return '—';
  return ROLE_LABELS[roleName] ?? roleName.replace(/_/g, ' ');
}

const HTTP_MESSAGES: Record<string, string> = {
  'Internal server error':
    'Erro ao contactar a API. Confira se o backend está ativo na porta 3010 e recarregue a página.',
  'Internal Server Error':
    'Erro ao contactar a API. Confira se o backend está ativo na porta 3010 e recarregue a página.',
  Unauthorized: 'Sessão expirada ou não autorizado. Faça login novamente.',
  Forbidden: 'Você não tem permissão para esta ação.',
  'Not Found': 'Registro não encontrado.',
  'Bad Request': 'Requisição inválida.',
};

/** Traduz código de enum/status; se não houver tradução, humaniza SNAKE_CASE. */
export function labelEnum(value: string | null | undefined): string {
  if (value == null || value === '') return '—';
  const direct = ENUM_LABELS[value];
  if (direct) return direct;
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/^\w|\s\w/g, (c) => c.toUpperCase());
}

/** Mensagem amigável a partir de resposta de erro da API ou exceção. */
export function formatApiError(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return 'Erro desconhecido';

  if (trimmed.startsWith('Error:')) {
    return formatApiError(trimmed.slice(6).trim());
  }

  if (trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed) as { message?: string | string[]; statusCode?: number };
      const m = j.message;
      const msg = Array.isArray(m) ? m.join(', ') : m;
      if (msg) return formatApiError(String(msg));
    } catch {
      /* texto não-JSON */
    }
  }

  for (const [en, pt] of Object.entries(HTTP_MESSAGES)) {
    if (trimmed.includes(en)) return pt;
  }

  return humanizeUserText(trimmed);
}

export function errorMessage(err: unknown, fallback = 'Erro'): string {
  if (err instanceof Error) return formatApiError(err.message);
  if (typeof err === 'string') return formatApiError(err);
  return fallback;
}
