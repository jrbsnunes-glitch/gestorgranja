import type { ReactNode } from 'react';

export function Card({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {title ? <h3 className="mb-2 text-sm font-semibold text-slate-700">{title}</h3> : null}
      {children}
    </div>
  );
}
