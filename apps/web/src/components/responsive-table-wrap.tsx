'use client';

import type { ReactNode } from 'react';

/** Scroll horizontal com dica no mobile (telas com `<table>` nativa). */
export function ResponsiveTableWrap({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`.trim()}>
      <p className="mb-1 text-xs text-slate-500 md:hidden">Deslize horizontalmente para ver todas as colunas.</p>
      <div className="overflow-x-auto overscroll-x-contain rounded-lg border border-slate-200 [-webkit-overflow-scrolling:touch]">
        {children}
      </div>
    </div>
  );
}
