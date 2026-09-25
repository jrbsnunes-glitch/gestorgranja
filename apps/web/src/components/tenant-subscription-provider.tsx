'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, useContext } from 'react';
import { getToken } from '@/lib/auth';
import { fetchTenantSubscription, type TenantSubscription } from '@/lib/tenant-subscription';

const Ctx = createContext<TenantSubscription | null>(null);

export function TenantSubscriptionProvider({ children }: { children: React.ReactNode }) {
  const enabled = typeof window !== 'undefined' && !!getToken();
  const { data } = useQuery({
    queryKey: ['tenant-subscription'],
    queryFn: fetchTenantSubscription,
    enabled,
    staleTime: 5 * 60_000,
  });

  return <Ctx.Provider value={data ?? null}>{children}</Ctx.Provider>;
}

export function useTenantSubscription() {
  return useContext(Ctx);
}
