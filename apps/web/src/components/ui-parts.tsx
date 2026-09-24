'use client';

import { Button, Card } from '@gestor-granja/ui';
import { formatApiError } from '@/lib/labels';
import { useIsMobile } from '@/lib/use-mobile';

export function PageCard({
  title,
  children,
  action,
}: {
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card title={title} className="mb-6">
      {action ? <div className="mb-4">{action}</div> : null}
      {children}
    </Card>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full min-h-11 rounded-md border border-slate-300 px-3 py-2 text-base md:min-h-0 md:text-sm';

export function SubmitButton({ label = 'Salvar', disabled }: { label?: string; disabled?: boolean }) {
  return (
    <Button type="submit" disabled={disabled} className="mt-2 min-h-11 w-full sm:w-auto">
      {label}
    </Button>
  );
}

export function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{formatApiError(message)}</p>;
}

export function SimpleTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | React.ReactNode)[][];
}) {
  const isMobile = useIsMobile();

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">Nenhum registro</p>;
  }

  if (isMobile) {
    return (
      <ul className="space-y-3">
        {rows.map((row, i) => (
          <li key={i} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            {headers.map((h, j) => (
              <div
                key={`${i}-${h}`}
                className={`flex gap-3 border-slate-100 py-2 text-sm first:pt-0 last:pb-0 ${
                  j < headers.length - 1 ? 'border-b' : ''
                }`}
              >
                <span className="w-[38%] shrink-0 text-xs font-medium uppercase tracking-wide text-slate-500">
                  {h}
                </span>
                <span className="min-w-0 flex-1 break-words text-slate-900">{row[j]}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-slate-100">
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
