'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { buildPunchQrPayload } from '@/lib/punch-qr';

type Props = {
  terminalId: string;
  token: string;
  expiresAt: string;
  size?: number;
  showTokenFallback?: boolean;
  className?: string;
};

export function PunchQrDisplay({
  terminalId,
  token,
  expiresAt,
  size = 280,
  showTokenFallback = true,
  className = '',
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const payload = buildPunchQrPayload(terminalId, token);
    void QRCode.toDataURL(payload, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    }).then((url) => {
      if (!cancelled) setDataUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [terminalId, token, size]);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      {dataUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="QR code para batida de ponto" width={size} height={size} className="rounded-lg border border-slate-200 bg-white p-2" />
      ) : (
        <div
          className="animate-pulse rounded-lg bg-slate-200"
          style={{ width: size, height: size }}
          aria-hidden
        />
      )}
      <p className="text-center text-sm text-slate-600">
        Válido até{' '}
        <time dateTime={expiresAt}>{new Date(expiresAt).toLocaleString('pt-BR')}</time>
      </p>
      {showTokenFallback ? (
        <details className="w-full max-w-md text-xs text-slate-500">
          <summary className="cursor-pointer text-center text-slate-600">Código manual (fallback)</summary>
          <p className="mt-2 break-all rounded bg-slate-100 p-2 font-mono">{token}</p>
        </details>
      ) : null}
    </div>
  );
}
