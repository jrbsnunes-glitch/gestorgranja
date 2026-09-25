'use client';

import { usePathname, useRouter } from 'next/navigation';
import { TabBar } from '@/components/list-crud';
import { useTenantSubscription } from '@/components/tenant-subscription-provider';
import { activeModuleTabId, moduleForPath } from '@/lib/module-nav';
import { isRhTabAllowed } from '@/lib/tenant-subscription';

/** Abas de seção do módulo (substituem submenus laterais). */
export function ModuleSectionTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const subscription = useTenantSubscription();
  const mod = moduleForPath(pathname);
  if (!mod?.tabs?.length) return null;

  const tabs =
    mod.id === 'rh'
      ? mod.tabs.filter((t) => isRhTabAllowed(t.id, subscription))
      : mod.tabs;
  if (!tabs.length) return null;

  const active = activeModuleTabId(pathname, tabs);

  return (
    <TabBar
      active={active}
      onChange={(id) => {
        const tab = tabs.find((t) => t.id === id);
        if (tab) router.push(tab.href);
      }}
      tabs={tabs.map((t) => ({ id: t.id, label: t.label }))}
    />
  );
}
