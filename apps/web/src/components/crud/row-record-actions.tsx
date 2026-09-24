'use client';

import { Button } from '@gestor-granja/ui';
import { useIsMobile } from '@/lib/use-mobile';

export function RowRecordActions({
  onEdit,
  onView,
  onDelete,
  canDelete = true,
}: {
  onEdit?: () => void;
  onView: () => void;
  onDelete?: () => void;
  canDelete?: boolean;
}) {
  const isMobile = useIsMobile();
  const btnClass = isMobile ? 'min-h-10 px-3 py-2 text-xs' : 'px-2 py-1 text-xs';
  return (
    <span className="flex flex-wrap gap-1.5 max-sm:w-full max-sm:justify-end">
      {onEdit ? (
        <Button type="button" variant="secondary" className={btnClass} onClick={onEdit}>
          Alterar
        </Button>
      ) : null}
      <Button type="button" variant="secondary" className={btnClass} onClick={onView}>
        Visualizar
      </Button>
      {onDelete ? (
        <Button
          type="button"
          variant="secondary"
          className={btnClass}
          disabled={!canDelete}
          onClick={onDelete}
        >
          Excluir
        </Button>
      ) : null}
    </span>
  );
}
