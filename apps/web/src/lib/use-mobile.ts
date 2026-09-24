'use client';

import { useSyncExternalStore } from 'react';

/** Alinhado ao breakpoint `md` do Tailwind (768px). */
export const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

function subscribeMobile(cb: () => void) {
  const mq = window.matchMedia(MOBILE_MEDIA_QUERY);
  mq.addEventListener('change', cb);
  return () => mq.removeEventListener('change', cb);
}

function getMobileSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribeMobile, getMobileSnapshot, getMobileServerSnapshot);
}
