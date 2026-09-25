'use client';

import { useEffect } from 'react';
import { CAMPO_BASE_PATH } from '@/lib/campo-base-path';

export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register(`${CAMPO_BASE_PATH}/sw.js`, { scope: `${CAMPO_BASE_PATH}/` });
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data?.type === 'SYNC') {
        window.dispatchEvent(new CustomEvent('gg-sync'));
      }
    });
  }, []);
  return null;
}
