'use client';

import type { ReactNode } from 'react';
import { Button } from '@gestor-granja/ui';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';

/** Launcher de relatórios por módulo (Fase 2). */
export function ModuleReportsModal({
  open,
  title,
  onClose,
  children,
  wide,
  compactLauncher,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  wide?: boolean;
  compactLauncher?: boolean;
}) {
  if (!open) return null;
  return (
    <ModalBackdrop onClose={onClose} wide={wide}>
      <div className="flex max-h-[92dvh] flex-col p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900">Relatórios — {title}</h2>
        <p className="mt-1 text-sm text-slate-500">
          {compactLauncher
            ? 'Informe filtros aqui. O relatório abrirá nesta aba com a pré-visualização de impressão.'
            : 'Relatórios específicos deste módulo.'}
        </p>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4">
          {children ?? (
            <p className="text-sm text-slate-600">
              Relatórios formais deste módulo estão na fila de implementação (Fase 2). Gere o relatório pelos
              filtros abaixo quando disponível.
            </p>
          )}
        </div>
        <div className="mt-4 shrink-0">
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
