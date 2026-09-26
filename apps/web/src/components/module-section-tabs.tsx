'use client';

import { usePathname, useRouter } from 'next/navigation';
import { TabBar } from '@/components/list-crud';
import { useTenantSubscription } from '@/components/tenant-subscription-provider';
import { filterModuleTabs } from '@/lib/nav-access';
import { activeModuleTabId, moduleForPath } from '@/lib/module-nav';
import { readSession } from '@/lib/session';
import { isRhTabAllowed, RH_TAB_PLAN_LOCK_HINT } from '@/lib/tenant-subscription';

/** Abas de seção do módulo (substituem submenus laterais). */
export function ModuleSectionTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const subscription = useTenantSubscription();
  const mod = moduleForPath(pathname);
  if (!mod?.tabs?.length) return null;

  const session = readSession();
  const tabs = filterModuleTabs(mod, session, subscription);
  if (!tabs.length) return null;

  const active = activeModuleTabId(pathname, tabs);

  return (
    <TabBar
      active={active}
      onChange={(id) => {
        const tab = tabs.find((t) => t.id === id);
        if (tab) router.push(tab.href);
      }}
      tabs={tabs.map((t) => {
        const planLocked = mod.id === 'rh' && subscription != null && !isRhTabAllowed(t.id, subscription);
        return {
          id: t.id,
          label: t.label,
          disabled: planLocked,
          title: planLocked ? RH_TAB_PLAN_LOCK_HINT : undefined,
        };
      })}
    />
  );
}
