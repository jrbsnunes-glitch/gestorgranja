'use client';

import type { ReactNode } from 'react';
import { useModalEscapeKey } from '@/lib/use-modal-escape';

export function ModalBackdrop({
  onClose,
  children,
  wide,
  align = 'center',
  fitViewport = false,
  className = '',
}: {
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** `top` deixa a listagem principal visível abaixo do painel. */
  align?: 'center' | 'top';
  /** Formulários grandes: usa quase a altura da tela sem scroll externo. */
  fitViewport?: boolean;
  className?: string;
}) {
  useModalEscapeKey(onClose);
  const alignClass =
    align === 'top'
      ? 'items-start justify-center bg-black/25 p-0 pt-3 sm:items-start sm:p-4 sm:pt-6'
      : 'items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4';
  return (
    <div
      className={`fixed inset-0 z-50 flex ${alignClass} ${className}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        className={
          fitViewport
            ? `flex max-h-[92dvh] w-full flex-col overflow-hidden bg-white shadow-xl sm:max-h-[90vh] sm:rounded-lg ${
                wide ? 'sm:max-w-4xl' : 'sm:max-w-3xl'
              } max-sm:rounded-t-2xl max-sm:max-h-[92dvh]`
            : `max-h-[min(70dvh,520px)] w-full overflow-y-auto bg-white shadow-xl sm:max-h-[min(75vh,560px)] sm:rounded-lg ${
                wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
              } max-sm:rounded-t-2xl`
        }
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
