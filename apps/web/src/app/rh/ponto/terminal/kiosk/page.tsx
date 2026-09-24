'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

function KioskRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const terminalId = searchParams.get('terminalId');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!terminalId) {
      setError('Informe ?terminalId= na URL ou use Copiar link quiosque em Terminal portaria.');
      return;
    }
    void apiFetch<{ quiosquePath: string }>(`/v1/hr/time/terminals/${terminalId}/kiosk-config`)
      .then((cfg) => router.replace(cfg.quiosquePath))
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao abrir quiosque'));
  }, [terminalId, router]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-center text-white">
        <p className="max-w-md text-sm">{error}</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <p className="text-sm">Abrindo quiosque…</p>
    </main>
  );
}

export default function PontoTerminalKioskPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
          Carregando…
        </main>
      }
    >
      <KioskRedirect />
    </Suspense>
  );
}
