'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useTenantSubscription } from '@/components/tenant-subscription-provider';
import { filterModuleTabs } from '@/lib/nav-access';
import { activeModuleTabId, moduleForPath } from '@/lib/module-nav';
import { operacaoTabIcon } from '@/lib/operacao-tab-icons';
import { readSession } from '@/lib/session';

/** Atalhos do mock (Painel, Lotes, Produção, Mortalidade, Relatórios) no celular. */
export function OperacaoBottomNav() {
  return (
    <Suspense fallback={null}>
      <OperacaoBottomNavInner />
    </Suspense>
  );
}

function OperacaoBottomNavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const subscription = useTenantSubscription();
  const mod = moduleForPath(pathname);
  if (mod?.id !== 'operacao' || !mod.tabs) return null;

  const session = readSession();
  const tabs = filterModuleTabs(mod, session, subscription).filter((t) => t.group !== 'more');
  if (!tabs.length) return null;
  const active = activeModuleTabId(pathname, tabs, searchParams.toString());

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-emerald-900/20 bg-[#12352a] px-1 pb-[env(safe-area-inset-bottom)] text-white md:hidden"
      aria-label="Produção"
    >
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${Math.min(tabs.length, 5)}, minmax(0, 1fr))` }}>
        {tabs.slice(0, 5).map((t) => {
          const on = t.id === active;
          return (
            <li key={t.id}>
              <Link
                href={t.href}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] leading-tight ${on ? 'text-emerald-200' : 'text-emerald-50/80'}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.icon ?? operacaoTabIcon(t.id)} alt="" className="h-5 w-5 object-contain" />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
