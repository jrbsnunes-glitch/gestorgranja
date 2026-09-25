'use client';

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { parsePunchQrPayload } from '@/lib/punch-qr';

type Props = {
  onScan: (data: { terminalId: string; token: string }) => void;
  onError?: (message: string) => void;
};

type Html5QrcodeInstance = {
  start: (
    cameraIdOrConfig: string | { facingMode: string },
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decodedText: string) => void,
    onFailure: (error: string) => void,
  ) => Promise<null>;
  stop: () => Promise<void>;
  clear: () => void;
};

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof Error ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return 'Permissão da câmera negada. Permita a câmera para este site nas configurações do celular.';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return 'Nenhuma câmera encontrada neste aparelho.';
  }
  if (name === 'NotReadableError') {
    return 'A câmera está em uso por outro app.';
  }
  return 'Não foi possível abrir a câmera.';
}

export function PunchQrScanner({ onScan, onError }: Props) {
  const regionId = useId().replace(/:/g, '');
  const scannerRef = useRef<Html5QrcodeInstance | null>(null);
  const [open, setOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      await scanner.stop();
    } catch {
      /* ignore */
    }
    try {
      scanner.clear();
    } catch {
      /* ignore */
    }
  }, []);

  const handlePayload = useCallback(
    (text: string) => {
      const parsed = parsePunchQrPayload(text);
      if (parsed) {
        onScan(parsed);
        return true;
      }
      return false;
    },
    [onScan],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start() {
      setStarting(true);
      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;
        const scanner = new Html5Qrcode(regionId) as unknown as Html5QrcodeInstance;
        scannerRef.current = scanner;
        const qrbox = Math.min(280, Math.floor(window.innerWidth * 0.75));
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: qrbox, height: qrbox } },
          (decodedText) => {
            if (handlePayload(decodedText)) {
              void stopCamera();
              setOpen(false);
            }
          },
          () => {},
        );
      } catch (err) {
        if (!cancelled) {
          onError?.(cameraErrorMessage(err));
          setOpen(false);
        }
        await stopCamera();
      } finally {
        if (!cancelled) setStarting(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      void stopCamera();
    };
  }, [open, regionId, handlePayload, onError, stopCamera]);

  return (
    <div className="space-y-2">
      {!open ? (
        <Button type="button" className="min-h-11 w-full" onClick={() => setOpen(true)}>
          Escanear QR da portaria
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">Aponte a câmera para o QR na portaria.</p>
          <div id={regionId} className="overflow-hidden rounded-lg border bg-black" />
          {starting ? <p className="text-center text-sm text-slate-500">Abrindo câmera…</p> : null}
          <Button type="button" className="w-full" onClick={() => { setOpen(false); void stopCamera(); }}>
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}
