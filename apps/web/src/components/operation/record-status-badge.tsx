'use client';

import { labelEnum } from '@/lib/labels';

const STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-800 border-amber-200',
  RECORDED: 'bg-slate-50 text-slate-700 border-slate-200',
  REVIEWED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  ADJUSTED: 'bg-sky-50 text-sky-800 border-sky-200',
  OPEN: 'bg-red-50 text-red-700 border-red-200',
  IN_PROGRESS: 'bg-amber-50 text-amber-800 border-amber-200',
  RESOLVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  CANCELLED: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** Selo de status para registros operacionais e ocorrências. */
export function RecordStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const cls = STYLES[status] ?? 'bg-slate-50 text-slate-700 border-slate-200';
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {labelEnum(status)}
    </span>
  );
}
