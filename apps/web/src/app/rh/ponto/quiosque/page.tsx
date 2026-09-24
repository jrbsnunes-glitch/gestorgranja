'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PunchTerminalQrPanel } from '@/components/punch-terminal-qr-panel';

function QuiosqueContent() {
  const searchParams = useSearchParams();
  const tenant = searchParams.get('tenant')?.trim() ?? '';
  const terminalId = searchParams.get('terminalId')?.trim() ?? '';
  const secret = searchParams.get('secret')?.trim() ?? '';
  const terminalName = searchParams.get('name')?.trim() || 'Terminal de ponto';

  if (!tenant || !terminalId || !secret) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 p-6 text-center text-white">
        <p className="max-w-md text-sm">
          Link incompleto. Em RH → Terminal portaria, selecione o terminal e use &quot;Copiar link quiosque&quot;.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 py-8 text-white">
      <h1 className="mb-1 text-2xl font-semibold tracking-tight">{terminalName}</h1>
      <p className="mb-8 max-w-md text-center text-sm text-slate-300">
        Escaneie com o celular (GestorGranja → Ponto → Escanear QR). Esta tela não exige login.
      </p>
      <div className="rounded-2xl bg-white p-6 shadow-xl">
        <PunchTerminalQrPanel
          terminalId={terminalId}
          terminalName={terminalName}
          compact
          publicKiosk={{ tenantSlug: tenant, deviceSecret: secret }}
        />
      </div>
      <p className="mt-8 text-xs text-slate-500">GestorGranja — quiosque de ponto</p>
    </main>
  );
}

export default function PontoQuiosquePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
          Carregando…
        </main>
      }
    >
      <QuiosqueContent />
    </Suspense>
  );
}
