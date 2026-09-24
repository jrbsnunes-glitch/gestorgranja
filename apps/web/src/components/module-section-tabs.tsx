'use client';

import { usePathname, useRouter } from 'next/navigation';
import { TabBar } from '@/components/list-crud';
import { activeModuleTabId, moduleForPath } from '@/lib/module-nav';

/** Abas de seção do módulo (substituem submenus laterais). */
export function ModuleSectionTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const mod = moduleForPath(pathname);
  if (!mod?.tabs?.length) return null;

  const active = activeModuleTabId(pathname, mod.tabs);

  return (
    <TabBar
      active={active}
      onChange={(id) => {
        const tab = mod.tabs!.find((t) => t.id === id);
        if (tab) router.push(tab.href);
      }}
      tabs={mod.tabs.map((t) => ({ id: t.id, label: t.label }))}
    />
  );
}
