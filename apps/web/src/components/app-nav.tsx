'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTenantSubscription } from '@/components/tenant-subscription-provider';
import { dispatchDashboardRefresh } from '@/lib/dashboard-refresh';
import { navItemsForSession } from '@/lib/nav-access';
import { moduleForPath } from '@/lib/module-nav';
import { readSession } from '@/lib/session';

export function AppNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const subscription = useTenantSubscription();
  const session = readSession();
  const items = navItemsForSession(session, subscription);

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {items.map((item) => {
        const mod = moduleForPath(item.href);
        const active = mod ? mod.match(pathname) : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.id}
            href={item.href}
            onClick={() => {
              if (pathname === item.href) dispatchDashboardRefresh();
              onNavigate?.();
            }}
            className={`block min-h-11 rounded-md px-3 py-2.5 leading-snug ${
              active ? 'bg-emerald-100 font-medium text-emerald-900' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
