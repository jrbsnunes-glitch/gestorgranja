'use client';

import { usePathname } from 'next/navigation';
import { useLayoutEffect } from 'react';
import { AdminShellFrame } from '@/components/admin-shell';
import { ShellTitleProvider, useShellTitleContext } from '@/components/shell-title-context';
import { isPublicAppRoute } from '@/lib/public-routes';
import { defaultShellTitleForPath } from '@/lib/shell-title-from-path';

function SyncPathTitle({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setState } = useShellTitleContext();

  useLayoutEffect(() => {
    setState({ title: defaultShellTitleForPath(pathname) });
  }, [pathname, setState]);

  return <>{children}</>;
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = isPublicAppRoute(pathname) || pathname.startsWith('/portal-licencas');

  if (isPublic) {
    return <>{children}</>;
  }

  return (
    <ShellTitleProvider>
      <SyncPathTitle>
        <AdminShellFrame>{children}</AdminShellFrame>
      </SyncPathTitle>
    </ShellTitleProvider>
  );
}
