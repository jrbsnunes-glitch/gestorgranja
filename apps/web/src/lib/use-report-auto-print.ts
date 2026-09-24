'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { waitForReportImages } from '@/lib/wait-for-report-images';

/** Dispara window.print() uma vez quando o relatório terminou de carregar (incl. logo). */
export function useReportAutoPrint(ready: boolean, rootRef?: RefObject<Element | null>) {
  const fired = useRef(false);
  useEffect(() => {
    if (!ready || fired.current) return;
    fired.current = true;
    let cancelled = false;

    void (async () => {
      const root = rootRef?.current ?? document.body;
      await waitForReportImages(root);
      if (cancelled) return;
      await new Promise((r) => window.setTimeout(r, 150));
      if (cancelled) return;
      window.print();
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, rootRef]);
}
