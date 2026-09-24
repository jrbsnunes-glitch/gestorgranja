'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@gestor-granja/ui';
import { PunchQrDisplay } from '@/components/punch-qr-display';
import { apiFetch } from '@/lib/api';
import { publicApiFetch } from '@/lib/public-api';

type QrPayload = { terminalId: string; token: string; expiresAt: string };

type Props = {
  terminalId: string;
  terminalName: string;
  refreshMs?: number;
  kioskHref?: string;
  compact?: boolean;
  /** Quiosque público (sem login) — usa segredo do terminal. */
  publicKiosk?: { tenantSlug: string; deviceSecret: string };
};

export function PunchTerminalQrPanel({
  terminalId,
  terminalName,
  refreshMs = 40_000,
  kioskHref,
  compact = false,
  publicKiosk,
}: Props) {
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = publicKiosk
        ? await publicApiFetch<QrPayload>(
            `/v1/public/${encodeURIComponent(publicKiosk.tenantSlug)}/hr/time/terminals/${terminalId}/qr`,
            {
              method: 'POST',
              body: JSON.stringify({ deviceSecret: publicKiosk.deviceSecret }),
            },
          )
        : await apiFetch<QrPayload>(`/v1/hr/time/terminals/${terminalId}/qr`, {
            method: 'POST',
            body: '{}',
          });
      setQr(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar QR');
    }
  }, [terminalId, publicKiosk]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), refreshMs);
    return () => window.clearInterval(id);
  }, [refresh, refreshMs]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!qr) {
    return <p className="text-sm text-slate-600">Gerando QR…</p>;
  }

  return (
    <div className={compact ? '' : 'mt-4'}>
      {!compact ? <h3 className="mb-3 text-lg font-medium text-slate-900">QR — {terminalName}</h3> : null}
      <PunchQrDisplay
        terminalId={qr.terminalId}
        token={qr.token}
        expiresAt={qr.expiresAt}
        size={compact ? 260 : 300}
        showTokenFallback={!compact && !publicKiosk}
      />
      <div className="mt-3 flex flex-wrap gap-2 justify-center">
        <Button type="button" variant="secondary" className="text-xs" onClick={() => void refresh()}>
          Atualizar agora
        </Button>
        {kioskHref && !publicKiosk ? (
          <Link href={kioskHref} target="_blank" rel="noopener noreferrer">
            <Button type="button" className="text-xs">
              Abrir quiosque (sem login)
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
