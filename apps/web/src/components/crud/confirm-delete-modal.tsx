'use client';

import { Button } from '@gestor-granja/ui';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';

export function ConfirmDeleteModal({
  open,
  title = 'Excluir registro',
  message,
  onClose,
  onConfirm,
  confirmLabel = 'Excluir',
}: {
  open: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
}) {
  if (!open) return null;
  return (
    <ModalBackdrop onClose={onClose}>
      <div className="p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-red-700 hover:bg-red-800"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
