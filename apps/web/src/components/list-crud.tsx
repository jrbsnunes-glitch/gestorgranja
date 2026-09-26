'use client';

import { Button } from '@gestor-granja/ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CrudListChrome } from '@/components/crud/crud-list-chrome';
import type { useCrudList } from '@/components/crud/use-crud-list';
import { SimpleTable } from '@/components/ui-parts';
import { formatRecordControl } from '@/lib/record-control';
import { useIsMobile } from '@/lib/use-mobile';

export const LIST_PAGE_SIZE = 30;

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: string; label: string; disabled?: boolean; title?: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-1 pb-px md:flex-wrap md:overflow-visible">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          disabled={t.disabled}
          title={t.title}
          onClick={() => {
            if (!t.disabled) onChange(t.id);
          }}
          className={`shrink-0 rounded-t-md px-4 py-2.5 text-sm font-medium max-md:min-h-11 ${
            t.disabled
              ? 'cursor-not-allowed text-slate-400'
              : active === t.id
                ? 'border border-b-0 border-slate-200 bg-white text-emerald-800'
                : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({
  title,
  open,
  onClose,
  children,
  wide,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div
        className={`max-h-[92dvh] w-full overflow-y-auto bg-white p-4 shadow-xl sm:max-h-[90vh] sm:rounded-lg sm:p-5 ${
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        } max-sm:rounded-t-2xl max-sm:pb-[max(1rem,env(safe-area-inset-bottom))]`}
        role="dialog"
        aria-modal
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function usePagination<T>(items: T[]) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(items.length / LIST_PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  useEffect(() => {
    setPage(0);
  }, [items.length]);
  const slice = useMemo(
    () => items.slice(safePage * LIST_PAGE_SIZE, safePage * LIST_PAGE_SIZE + LIST_PAGE_SIZE),
    [items, safePage],
  );
  return { page: safePage, setPage, totalPages, slice, total: items.length, pageSize: LIST_PAGE_SIZE };
}

export function PaginationBar({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total <= LIST_PAGE_SIZE) return null;
  return (
    <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <span className="text-center sm:text-left">
        {total} registro(s) — página {page + 1} de {totalPages}
      </span>
      <div className="flex gap-2 max-sm:w-full">
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 flex-1 sm:flex-none"
          disabled={page <= 0}
          onClick={() => onPage(page - 1)}
        >
          Anterior
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="min-h-11 flex-1 sm:flex-none"
          disabled={page >= totalPages - 1}
          onClick={() => onPage(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}

export type CrudListState = ReturnType<typeof useCrudList<unknown>>;

/** @deprecated Prefer `CrudListChrome` + `useCrudList` from `@/components/crud`. */
export function ListToolbar({
  onInclude,
  label = 'Incluir',
  list,
  onReports,
  showDateFilter,
  searchPlaceholder,
  showPrint = false,
}: {
  onInclude?: () => void;
  label?: string;
  list?: CrudListState;
  onReports?: () => void;
  showDateFilter?: boolean;
  searchPlaceholder?: string;
  showPrint?: boolean;
}) {
  if (list) {
    return (
      <CrudListChrome
        list={list}
        onInclude={onInclude}
        onReports={onReports}
        onPrint={showPrint ? () => window.print() : undefined}
        showDateFilter={showDateFilter}
        searchPlaceholder={searchPlaceholder}
      />
    );
  }
  return (
    <div className="mb-4 flex justify-end max-sm:w-full">
      <Button type="button" className="min-h-11 max-sm:w-full max-sm:justify-center" onClick={onInclude}>
        {label}
      </Button>
    </div>
  );
}

export function RowActions({
  onView,
  onEdit,
  onInactivate,
  onDelete,
  inactivateLabel = 'Inativar',
  editLabel = 'Alterar',
}: {
  onView: () => void;
  onEdit?: () => void;
  onInactivate?: () => void;
  onDelete?: () => void;
  inactivateLabel?: string;
  editLabel?: string;
}) {
  const isMobile = useIsMobile();
  const btnClass = isMobile ? 'min-h-10 px-3 py-2 text-xs' : 'px-2 py-1 text-xs';
  return (
    <span className="flex flex-wrap gap-1.5 max-sm:w-full max-sm:justify-end">
      <Button type="button" variant="secondary" className={btnClass} onClick={onView}>
        Visualizar
      </Button>
      {onEdit ? (
        <Button type="button" variant="secondary" className={btnClass} onClick={onEdit}>
          {editLabel}
        </Button>
      ) : null}
      {onInactivate ? (
        <Button type="button" variant="secondary" className={btnClass} onClick={onInactivate}>
          {inactivateLabel}
        </Button>
      ) : null}
      {onDelete ? (
        <Button type="button" variant="secondary" className={btnClass} onClick={onDelete}>
          Excluir
        </Button>
      ) : null}
    </span>
  );
}

export function PaginatedTable({
  headers,
  rows,
  recordItems,
  page,
  totalPages,
  total,
  onPage,
}: {
  headers: string[];
  rows: (string | ReactNode)[][];
  /** Mesma ordem de `rows`: exibe coluna Controle com o número do registro. */
  /** Itens alinhados a `rows`; coluna Controle só aparece se tiver `controlNumber`. */
  recordItems?: unknown[];
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const showControl = recordItems != null && recordItems.length === rows.length;
  const tableHeaders = showControl ? ['Controle', ...headers] : headers;
  const tableRows = showControl
    ? rows.map((row, i) => {
        const cn = (recordItems[i] as { controlNumber?: number | null } | undefined)?.controlNumber;
        return [formatRecordControl(cn), ...row];
      })
    : rows;

  return (
    <>
      <SimpleTable headers={tableHeaders} rows={tableRows} />
      <PaginationBar page={page} totalPages={totalPages} total={total} onPage={onPage} />
    </>
  );
}

export function DetailGrid({ entries }: { entries: [string, ReactNode][] }) {
  return (
    <dl className="grid gap-2 text-sm sm:grid-cols-2">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded border border-slate-100 p-2">
          <dt className="text-xs text-slate-500">{k}</dt>
          <dd className="font-medium text-slate-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export type ModalMode = 'include' | 'edit' | 'view' | null;
