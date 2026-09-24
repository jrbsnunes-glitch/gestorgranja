'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js');
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data?.type === 'SYNC') {
        window.dispatchEvent(new CustomEvent('gg-sync'));
      }
    });
  }, []);
  return null;
}
