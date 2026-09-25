'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { AppChrome } from '@/components/app-chrome';
import { TenantSubscriptionProvider } from '@/components/tenant-subscription-provider';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } }));
  return (
    <QueryClientProvider client={client}>
      <TenantSubscriptionProvider>
        <AppChrome>{children}</AppChrome>
      </TenantSubscriptionProvider>
    </QueryClientProvider>
  );
}
