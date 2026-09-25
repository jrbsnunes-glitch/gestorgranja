import { APP_MODULES, type AppModule } from '@/lib/module-nav';
import { isAdminSession, type SessionUser } from '@/lib/session';
import { isRhTabAllowed, type TenantSubscription } from '@/lib/tenant-subscription';

export type NavItem = { id: string; label: string; href: string };

function hasAnyPermission(session: SessionUser, codes: string[]): boolean {
  if (session.permissions.includes('*')) return true;
  return codes.some((c) => session.permissions.includes(c));
}

/** Só perfil operador de campo (sem outros papéis). */
export function isFieldOperatorOnly(session: SessionUser | null): boolean {
  if (!session?.roles.length) return false;
  return session.roles.every((r) => r === 'operador_campo');
}

const MODULE_ACCESS: Record<string, string[]> = {
  dashboard: ['reports.read', 'production.read', 'finance.write', 'hr.read', 'sales.read', 'cash.read'],
  operacao: ['production.read', 'production.write', 'health.write', 'nutrition.write'],
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

  if (isFieldOperatorOnly(session)) {
    const items: NavItem[] = [{ id: 'producao-campo', label: 'Lançamento de produção', href: '/producao' }];
    if (isRhTabAllowed('ponto', sub) && hasAnyPermission(session, ['hr.read'])) {
      items.push({ id: 'ponto', label: 'Batida de ponto', href: '/rh/ponto' });
    }
    return items;
  }

  return APP_MODULES.filter((m) => canAccessModule(m, session, sub)).map((m) => ({
    id: m.id,
    label: m.label,
    href: m.href,
  }));
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

  if (isFieldOperatorOnly(session) && mod.id === 'operacao') {
    return mod.tabs.filter((t) => t.id === 'producao');
  }

  if (isFieldOperatorOnly(session) && mod.id === 'rh') {
    return mod.tabs.filter((t) => t.id === 'ponto' && isRhTabAllowed(t.id, sub));
  }

  if (mod.id === 'rh') {
    return mod.tabs.filter((t) => isRhTabAllowed(t.id, sub));
  }

  if (mod.id === 'operacao') {
    const tabs: typeof mod.tabs = [];
    if (hasAnyPermission(session, ['production.read', 'production.write'])) {
      const p = mod.tabs.find((t) => t.id === 'producao');
      if (p) tabs.push(p);
    }
    if (hasAnyPermission(session, ['health.write'])) {
      const s = mod.tabs.find((t) => t.id === 'sanidade');
      if (s) tabs.push(s);
    }
    return tabs.filter(Boolean);
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
  if (isFieldOperatorOnly(session)) return '/producao';
  const items = navItemsForSession(session, null);
  return items[0]?.href ?? '/dashboard';
}
