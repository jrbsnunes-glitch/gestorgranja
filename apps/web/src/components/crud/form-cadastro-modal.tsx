'use client';

import type { ReactNode } from 'react';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';

export type FormCadastroModalSize = 'md' | 'lg' | 'xl';

export function FormCadastroModal({
  open,
  onClose,
  title,
  hint,
  headerExtra,
  children,
  footer,
  wide = true,
  size = 'lg',
  dense = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  hint?: ReactNode;
  headerExtra?: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
  size?: FormCadastroModalSize;
  /** Menos padding — formulários com muitos campos. */
  dense?: boolean;
}) {
  if (!open) return null;
  const backdropWide = size === 'xl' || wide;
  const pad = dense ? 'px-4 py-2 sm:px-5' : 'px-4 py-4 sm:px-5';
  const headPad = dense ? 'px-4 py-2.5 sm:px-5' : 'px-4 py-4 sm:px-5';
  const footPad = dense ? 'px-4 py-2 sm:px-5' : 'px-4 py-3 sm:px-5';

  return (
    <ModalBackdrop onClose={onClose} wide={backdropWide} fitViewport className="">
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className={`shrink-0 border-b border-slate-100 ${headPad}`}>
          <h2 className={`font-semibold text-slate-900 ${dense ? 'text-base' : 'text-lg'}`}>{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-slate-500">{hint}</p> : null}
          {headerExtra}
        </div>
        <div
          className={`min-h-0 flex-1 ${dense ? 'overflow-visible' : 'overflow-y-auto'} ${pad}`}
        >
          {children}
        </div>
        <div className={`flex shrink-0 flex-wrap gap-2 border-t border-slate-100 ${footPad}`}>{footer}</div>
      </div>
    </ModalBackdrop>
  );
}
