'use client';

import { Button } from '@gestor-granja/ui';
import type { ReactNode } from 'react';

export type CrudToolbarProps = {
  leadingPrimary?: ReactNode;
  onInclude?: () => void;
  onPrint?: () => void;
  onReports?: () => void;
  includeLabel?: string;
  reportsDisabled?: boolean;
  reportsTitle?: string;
};

export function CrudToolbar({
  leadingPrimary,
  onInclude,
  onPrint,
  onReports,
  includeLabel = 'Incluir',
  reportsDisabled,
  reportsTitle,
}: CrudToolbarProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2">{leadingPrimary}</div>
      <div className="flex flex-wrap gap-2 max-sm:w-full">
        {onInclude != null ? (
          <Button type="button" className="min-h-11 max-sm:flex-1" onClick={onInclude}>
            {includeLabel}
          </Button>
        ) : null}
        {onPrint != null ? (
          <Button type="button" variant="secondary" className="min-h-11 max-sm:flex-1" onClick={onPrint}>
            Imprimir
          </Button>
        ) : null}
        {onReports != null ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11 max-sm:flex-1"
            onClick={onReports}
            disabled={reportsDisabled}
            title={reportsTitle}
          >
            Relatórios
          </Button>
        ) : null}
      </div>
    </div>
  );
}
