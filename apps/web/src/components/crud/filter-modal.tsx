'use client';

import type { ReactNode } from 'react';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';

export function FilterModal({
  open,
  title = 'Filtros',
  onClose,
  children,
}: {
  open: boolean;
  title?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="flex max-h-[92dvh] flex-col p-4 sm:p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </ModalBackdrop>
  );
}
