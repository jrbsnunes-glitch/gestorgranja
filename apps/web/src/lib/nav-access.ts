import { APP_MODULES, type AppModule } from '@/lib/module-nav';
import { isAdminSession, type SessionUser } from '@/lib/session';
import { isRhTabAllowed, type TenantSubscription } from '@/lib/tenant-subscription';

export type NavItem = { id: string; label: string; href: string };

const PONTO_ITEM: NavItem = { id: 'ponto', label: 'Batida de ponto', href: '/rh/ponto' };
const PRODUCAO_ITEM: NavItem = {
  id: 'producao-campo',
  label: 'Lançamento de produção',
  href: '/producao',
};

function hasAnyPermission(session: SessionUser, codes: string[]): boolean {
  if (session.permissions.includes('*')) return true;
  return codes.some((c) => session.permissions.includes(c));
}

const FIELD_WORKER_ROLES = new Set(['operador_campo', 'funcionario']);

/** Só perfis de campo (sem RH admin, gestor, etc.). */
export function isFieldWorkerOnly(session: SessionUser | null): boolean {
  if (!session?.roles.length) return false;
  return session.roles.every((r) => FIELD_WORKER_ROLES.has(r));
}

/** Operador/funcionário ou JWT antigo com permissões típicas de campo. */
export function isFieldOperatorLike(session: SessionUser | null): boolean {
  if (!session) return false;
  if (isFieldWorkerOnly(session)) return true;
  if (session.roles.length > 0) return false;
  return (
    hasAnyPermission(session, ['production.write']) &&
    hasAnyPermission(session, ['sync.write']) &&
    !hasAnyPermission(session, ['admin.users', 'finance.write', 'hr.write'])
  );
}

/** Plano Completo (ponto). Enquanto subscription carrega, mantém visível. */
export function canUseTimeClockNav(sub: TenantSubscription | null): boolean {
  if (!sub) return true;
  return sub.includesTimeClock;
}

/** Funcionários / operadores que devem ver batida de ponto no menu. */
export function shouldShowPontoNav(session: SessionUser, sub: TenantSubscription | null): boolean {
  if (isAdminSession(session)) return false;
  if (!canUseTimeClockNav(sub)) return false;
  if (hasAnyPermission(session, ['hr.read', 'hr.write'])) return true;
  if (isFieldOperatorLike(session)) return true;
  if (hasAnyPermission(session, ['production.write'])) return true;
  return false;
}

function withPontoItem(items: NavItem[], session: SessionUser, sub: TenantSubscription | null): NavItem[] {
  if (!shouldShowPontoNav(session, sub)) return items;
  if (items.some((i) => i.href === PONTO_ITEM.href)) return items;
  return [...items, PONTO_ITEM];
}

const MODULE_ACCESS: Record<string, string[]> = {
  dashboard: ['reports.read', 'production.read', 'finance.write', 'hr.read', 'sales.read', 'cash.read'],
  operacao: [
    'production.read',
    'production.write',
    'production.review',
    'occurrences.write',
    'operation.settings',
    'health.write',
    'nutrition.write',
  ],
  produtos: ['cadastros.read', 'cadastros.write', 'inventory.write'],
  estoque: ['inventory.write', 'purchasing.write'],
  comercial: ['sales.read', 'sales.write'],
  parceiros: ['cadastros.read', 'cadastros.write', 'sales.read'],
  financeiro: ['finance.write', 'cash.read', 'cash.write', 'cash.reconcile'],
  rh: ['hr.read', 'hr.write'],
  empresa: ['cadastros.read', 'cadastros.write', 'admin.users'],
  cadastros: ['cadastros.read', 'cadastros.write'],
  sistema: ['admin.users'],
};

function canAccessModule(mod: AppModule, session: SessionUser, sub: TenantSubscription | null): boolean {
  if (mod.id === 'rh') {
    if (!hasAnyPermission(session, MODULE_ACCESS.rh)) return false;
    if (!sub) return true;
    return mod.tabs?.some((t) => isRhTabAllowed(t.id, sub)) ?? false;
  }

  const required = MODULE_ACCESS[mod.id];
  if (!required) return false;
  return hasAnyPermission(session, required);
}

/** Itens do menu lateral conforme perfil e plano. */
export function navItemsForSession(
  session: SessionUser | null,
  sub: TenantSubscription | null,
): NavItem[] {
  if (!session) return [];

  if (isAdminSession(session)) {
    return APP_MODULES.map((m) => ({ id: m.id, label: m.label, href: m.href }));
  }

  if (isFieldOperatorLike(session)) {
    const items: NavItem[] = [PRODUCAO_ITEM];
    return withPontoItem(items, session, sub);
  }

  let items = APP_MODULES.filter((m) => canAccessModule(m, session, sub)).map((m) => ({
    id: m.id,
    label: m.label,
    href: m.href,
  }));

  // RH só leitura (funcionário): não abre cadastro de funcionários; atalho direto ao ponto
  const hrReadOnly =
    hasAnyPermission(session, ['hr.read']) && !hasAnyPermission(session, ['hr.write']);
  if (hrReadOnly) {
    items = items.filter((m) => m.id !== 'rh');
  }

  return withPontoItem(items, session, sub);
}

/** Abas internas do módulo (ex.: Produção vs Sanidade). */
export function filterModuleTabs(
  mod: AppModule,
  session: SessionUser | null,
  sub: TenantSubscription | null,
) {
  if (!mod.tabs?.length || !session) return mod.tabs ?? [];

  if (isAdminSession(session)) {
    if (mod.id === 'rh') return mod.tabs.filter((t) => isRhTabAllowed(t.id, sub));
    return mod.tabs;
  }

  if (isFieldOperatorLike(session) && mod.id === 'operacao') {
    const allowed = new Set(['producao', 'registro-diario']);
    if (hasAnyPermission(session, ['occurrences.write'])) allowed.add('ocorrencias');
    return mod.tabs.filter((t) => allowed.has(t.id));
  }

  if (isFieldOperatorLike(session) && mod.id === 'rh') {
    return mod.tabs.filter((t) => t.id === 'ponto' && isRhTabAllowed(t.id, sub));
  }

  if (mod.id === 'rh') {
    const hrReadOnly =
      hasAnyPermission(session, ['hr.read']) && !hasAnyPermission(session, ['hr.write']);
    if (hrReadOnly) {
      return mod.tabs.filter((t) => t.id === 'ponto' && isRhTabAllowed(t.id, sub));
    }
    return mod.tabs.filter((t) => isRhTabAllowed(t.id, sub));
  }

  if (mod.id === 'operacao') {
    const prod = hasAnyPermission(session, ['production.read', 'production.write', 'production.review']);
    const TAB_RULES: Record<string, boolean> = {
      dashboard: prod,
      'registro-diario': prod,
      producao: prod,
      lotes: prod,
      galpoes: prod,
      ocorrencias: prod || hasAnyPermission(session, ['occurrences.write']),
      insumos: hasAnyPermission(session, ['production.write', 'inventory.write']),
      perdas: prod,
      pendencias: prod,
      sanidade: hasAnyPermission(session, ['health.write']),
      configuracoes: hasAnyPermission(session, ['operation.settings']),
    };
    return mod.tabs.filter((t) => TAB_RULES[t.id] ?? false);
  }

  if (mod.id === 'estoque') {
    const tabs: typeof mod.tabs = [];
    if (hasAnyPermission(session, ['inventory.write'])) {
      tabs.push(...mod.tabs.filter((t) => ['movimentos', 'entradas'].includes(t.id)));
    }
    if (hasAnyPermission(session, ['purchasing.write'])) {
      const c = mod.tabs.find((t) => t.id === 'compras');
      if (c) tabs.push(c);
    }
    return tabs;
  }

  if (mod.id === 'financeiro') {
    return mod.tabs.filter(() => hasAnyPermission(session, MODULE_ACCESS.financeiro));
  }

  if (mod.id === 'cadastros') {
    return hasAnyPermission(session, MODULE_ACCESS.cadastros) ? mod.tabs : [];
  }

  if (mod.id === 'sistema') {
    const tabs: typeof mod.tabs = [];
    if (session.permissions.includes('admin.users')) {
      tabs.push(...mod.tabs);
    }
    return tabs;
  }

  return mod.tabs;
}

export function getPostLoginPath(session: SessionUser | null): string {
  if (!session) return '/dashboard';
  if (isAdminSession(session)) return '/dashboard';
  if (isFieldOperatorLike(session)) return '/producao';
  const items = navItemsForSession(session, null);
  return items[0]?.href ?? '/dashboard';
}
