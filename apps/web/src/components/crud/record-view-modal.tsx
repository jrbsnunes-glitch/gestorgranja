'use client';

import type { ReactNode } from 'react';
import { Button } from '@gestor-granja/ui';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';
import { SimpleTable } from '@/components/ui-parts';

export type RecordViewField = { label: string; value: ReactNode };
export type RecordViewColumn = string | { label: string; num?: boolean };
export type RecordViewFieldsSection = { title: string; fields: RecordViewField[] };
export type RecordViewTableSection = {
  title: string;
  empty?: string;
  columns: RecordViewColumn[];
  rows: ReactNode[][];
};
export type RecordViewCustomSection = { title: string; content: ReactNode };
export type RecordViewSection = RecordViewFieldsSection | RecordViewTableSection | RecordViewCustomSection;

function isFieldsSection(s: RecordViewSection): s is RecordViewFieldsSection {
  return 'fields' in s;
}

function isTableSection(s: RecordViewSection): s is RecordViewTableSection {
  return 'columns' in s && 'rows' in s;
}

function displayValue(value: ReactNode): ReactNode {
  if (value == null || value === '') return '—';
  return value;
}

function columnLabel(c: RecordViewColumn): string {
  return typeof c === 'string' ? c : c.label;
}

function RecordViewFieldsTable({ fields }: { fields: RecordViewField[] }) {
  return (
    <SimpleTable
      headers={['Campo', 'Valor']}
      rows={fields.map((f) => [f.label, displayValue(f.value)])}
    />
  );
}

function RecordViewDataTable({
  columns,
  rows,
  empty,
}: {
  columns: RecordViewColumn[];
  rows: ReactNode[][];
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-slate-500">{empty ?? 'Nenhum registro.'}</p>;
  }
  return (
    <SimpleTable
      headers={columns.map(columnLabel)}
      rows={rows.map((cells) => cells.map((c) => displayValue(c)))}
    />
  );
}

function RecordViewSections({ sections }: { sections: RecordViewSection[] }) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-600">{section.title}</h3>
          {isFieldsSection(section) ? (
            <RecordViewFieldsTable fields={section.fields} />
          ) : isTableSection(section) ? (
            <RecordViewDataTable columns={section.columns} rows={section.rows} empty={section.empty} />
          ) : (
            section.content
          )}
        </div>
      ))}
    </div>
  );
}

export function RecordViewModal({
  open,
  title,
  onClose,
  wide,
  loading,
  error,
  sections = [],
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  wide?: boolean;
  loading?: boolean;
  error?: string | null;
  sections?: RecordViewSection[];
  children?: ReactNode;
}) {
  if (!open) return null;
  return (
    <ModalBackdrop onClose={onClose} wide={wide}>
      <div className="flex max-h-[92dvh] flex-col p-4 sm:max-h-[90vh] sm:p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900">{title}</h2>
        {loading ? <p className="text-sm text-slate-600">Carregando…</p> : null}
        {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!loading && !error ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            {sections.length > 0 ? <RecordViewSections sections={sections} /> : null}
            {children}
          </div>
        ) : null}
        <div className="mt-4 shrink-0 border-t border-slate-100 pt-3">
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </ModalBackdrop>
  );
}
