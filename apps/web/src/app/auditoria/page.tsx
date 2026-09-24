'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuditoriaPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/logs');
  }, [router]);
  return <p className="p-6 text-sm text-slate-500">Redirecionando para Logs…</p>;
}
