'use client';

import { useEffect } from 'react';

export function PortalLicencasSwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/portal-licencas/sw.js', { scope: '/portal-licencas/' });
  }, []);
  return null;
}
