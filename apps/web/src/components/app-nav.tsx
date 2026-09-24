'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { APP_MODULES } from '@/lib/module-nav';
import { dispatchDashboardRefresh } from '@/lib/dashboard-refresh';

export function AppNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 text-sm">
      {APP_MODULES.map((mod) => {
        const active = mod.match(pathname);
        return (
          <Link
            key={mod.id}
            href={mod.href}
            onClick={() => {
              if (pathname === mod.href) dispatchDashboardRefresh();
              onNavigate?.();
            }}
            className={`block min-h-11 rounded-md px-3 py-2.5 leading-snug ${
              active ? 'bg-emerald-100 font-medium text-emerald-900' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            {mod.label}
          </Link>
        );
      })}
    </nav>
  );
}
