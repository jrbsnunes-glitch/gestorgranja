'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { parsePunchQrPayload } from '@/lib/punch-qr';

type Props = {
  onScan: (data: { terminalId: string; token: string }) => void;
  onError?: (message: string) => void;
};

export function PunchQrScanner({ onScan, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const handlePayload = useCallback(
    (text: string) => {
      const parsed = parsePunchQrPayload(text);
      if (parsed) {
        onScan(parsed);
        setOpen(false);
        stopCamera();
        return true;
      }
      return false;
    },
    [onScan, stopCamera],
  );

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'BarcodeDetector' in window);
  }, []);

  useEffect(() => {
    if (!open || !supported) return;

    let cancelled = false;
    const Detector = (window as Window & { BarcodeDetector?: new (opts: { formats: string[] }) => {
      detect: (source: HTMLVideoElement) => Promise<{ rawValue?: string }[]>;
    } }).BarcodeDetector;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        if (!Detector) return;
        const detector = new Detector({ formats: ['qr_code'] });
        timerRef.current = window.setInterval(() => {
          const v = videoRef.current;
          if (!v || v.readyState < 2) return;
          void detector.detect(v).then((codes) => {
            for (const c of codes) {
              if (c.rawValue && handlePayload(c.rawValue)) break;
            }
          });
        }, 400);
      } catch {
        onError?.('Não foi possível acessar a câmera. Use o código manual ou digite o token.');
        setOpen(false);
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [open, supported, handlePayload, onError, stopCamera]);

  if (supported === false) {
    return (
      <p className="text-xs text-slate-500">
        Seu navegador não suporta leitura de QR pela câmera. Informe o token manualmente ou use Chrome/Edge no celular.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Escanear QR da portaria
        </Button>
      ) : (
        <div className="space-y-2">
          <video ref={videoRef} className="max-h-64 w-full rounded-lg border border-slate-200 bg-black object-cover" muted playsInline />
          <Button type="button" variant="secondary" onClick={() => { setOpen(false); stopCamera(); }}>
            Cancelar câmera
          </Button>
        </div>
      )}
    </div>
  );
}
