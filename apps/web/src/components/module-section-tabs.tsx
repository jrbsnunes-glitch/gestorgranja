'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { TabBar } from '@/components/list-crud';
import { useTenantSubscription } from '@/components/tenant-subscription-provider';
import { filterModuleTabs } from '@/lib/nav-access';
import { activeModuleTabId, type ModuleTab, moduleForPath } from '@/lib/module-nav';
import { operacaoTabIcon } from '@/lib/operacao-tab-icons';
import { readSession } from '@/lib/session';
import { isRhTabAllowed, RH_TAB_PLAN_LOCK_HINT } from '@/lib/tenant-subscription';

function toBarTabs(
  tabs: ModuleTab[],
  modId: string,
  subscription: ReturnType<typeof useTenantSubscription>,
) {
  return tabs.map((t) => {
    const planLocked = modId === 'rh' && subscription != null && !isRhTabAllowed(t.id, subscription);
    const icon =
      t.icon ?? (modId === 'operacao' ? operacaoTabIcon(t.id) : undefined);
    return {
      id: t.id,
      label: t.label,
      icon,
      disabled: planLocked,
      title: planLocked ? RH_TAB_PLAN_LOCK_HINT : undefined,
    };
  });
}

/** Abas de seção do módulo (substituem submenus laterais). */
export function ModuleSectionTabs() {
  return (
    <Suspense fallback={null}>
      <ModuleSectionTabsInner />
    </Suspense>
  );
}

function ModuleSectionTabsInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const subscription = useTenantSubscription();
  const [moreOpen, setMoreOpen] = useState(false);
  const mod = moduleForPath(pathname);
  if (!mod?.tabs?.length) return null;

  const session = readSession();
  const tabs = filterModuleTabs(mod, session, subscription);
  if (!tabs.length) return null;

  const search = searchParams.toString();
  const active = activeModuleTabId(pathname, tabs, search);
  const go = (id: string) => {
    const tab = tabs.find((t) => t.id === id);
    if (tab) router.push(tab.href);
    setMoreOpen(false);
  };

  const hasGroups = tabs.some((t) => t.group);
  if (!hasGroups) {
    return <TabBar active={active} onChange={go} tabs={toBarTabs(tabs, mod.id, subscription)} />;
  }

  const primary = tabs.filter((t) => t.group !== 'more');
  const more = tabs.filter((t) => t.group === 'more');
  const moreActive = more.some((t) => t.id === active);

  return (
    <div className="mb-2">
      <TabBar active={active} onChange={go} tabs={toBarTabs(primary, mod.id, subscription)} />
      {more.length ? (
        <div className="relative -mt-3 mb-3">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-sm ${moreActive ? 'bg-emerald-50 font-medium text-emerald-900' : 'text-slate-600 hover:bg-slate-50'}`}
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
          >
            Mais{moreActive ? ` · ${more.find((t) => t.id === active)?.label}` : ''}
          </button>
          {moreOpen ? (
            <div className="absolute z-20 mt-1 min-w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg">
              {more.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${t.id === active ? 'font-medium text-emerald-800' : 'text-slate-700'}`}
                  onClick={() => go(t.id)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={t.icon ?? (mod.id === 'operacao' ? operacaoTabIcon(t.id) : '/producao/ovo.svg')}
                    alt=""
                    className="h-4 w-4 object-contain"
                  />
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
