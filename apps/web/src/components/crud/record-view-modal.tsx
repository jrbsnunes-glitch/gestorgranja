'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Button } from '@gestor-granja/ui';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';
import { RecordViewFieldsGrid } from '@/components/crud/record-view-presentation';
import { auditTrailLogsHref, type AuditTrailRef } from '@/lib/audit-trail';

export type RecordViewField = { label: string; value: ReactNode; icon?: string };
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
    return <p className="py-2 text-sm text-slate-500">{empty ?? 'Nenhum registro.'}</p>;
  }
  const headers = columns.map(columnLabel);
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-100">
      <table className="w-full min-w-[280px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            {headers.map((h) => (
              <th key={h} className="px-2.5 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, ri) => (
            <tr key={ri} className="border-b border-slate-50 last:border-0">
              {cells.map((c, ci) => (
                <td key={ci} className="px-2.5 py-2 text-slate-800">
                  {displayValue(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RecordViewSections({ sections }: { sections: RecordViewSection[] }) {
  let heroShown = false;
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.title}>
          <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{section.title}</h3>
          {isFieldsSection(section) ? (
            <RecordViewFieldsGrid
              fields={section.fields}
              showHero={!heroShown && section.fields.length > 0 ? ((heroShown = true), true) : false}
            />
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

function countFields(sections: RecordViewSection[]) {
  return sections.filter(isFieldsSection).reduce((n, s) => n + s.fields.length, 0);
}

export function RecordViewModal({
  open,
  title,
  onClose,
  wide,
  compact,
  scrollable,
  loading,
  error,
  sections = [],
  children,
  auditTrail,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  /** Abre o menu Logs com o histórico deste registro (sem embutir tabela no modal). */
  auditTrail?: AuditTrailRef | null;
  wide?: boolean;
  /** Modal ajustado à viewport (padrão do sistema). */
  compact?: boolean;
  /** Conteúdo longo (formulários, tabelas): rolagem só na área central. */
  scrollable?: boolean;
  loading?: boolean;
  error?: string | null;
  sections?: RecordViewSection[];
  children?: ReactNode;
}) {
  if (!open) return null;

  const hasTable = sections.some(isTableSection);
  const fieldCount = countFields(sections);
  const useCompact = compact ?? true;
  const contentScrolls =
    scrollable ?? (Boolean(children) || hasTable || fieldCount > 12);

  return (
    <ModalBackdrop onClose={onClose} wide={wide} fitViewport={useCompact}>
      <div
        className={`flex min-h-0 flex-col p-4 sm:p-5 ${useCompact ? 'max-h-[inherit] flex-1' : 'max-h-[92dvh] sm:max-h-[90vh]'}`}
      >
        <h2 className="mb-2 shrink-0 text-lg font-semibold text-slate-900">{title}</h2>
        {loading ? <p className="text-sm text-slate-600">Carregando…</p> : null}
        {error ? <p className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        {!loading && !error ? (
          <div
            className={
              contentScrolls ? 'min-h-0 flex-1 overflow-y-auto overflow-x-hidden' : 'shrink-0'
            }
          >
            {sections.length > 0 ? <RecordViewSections sections={sections} /> : null}
            {children}
          </div>
        ) : null}
        <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <Button type="button" onClick={onClose}>
            Fechar
          </Button>
          {auditTrail ? (
            <Link
              href={auditTrailLogsHref(auditTrail.entity, auditTrail.entityId)}
              className="text-sm font-medium text-emerald-800 underline-offset-2 hover:underline"
              onClick={onClose}
            >
              Ver histórico de alterações em Logs
            </Link>
          ) : null}
        </div>
      </div>
    </ModalBackdrop>
  );
}
