'use client';

import { Button } from '@gestor-granja/ui';

export function SearchResultsBanner({
  query,
  count,
  total,
  onClear,
}: {
  query: string;
  count: number;
  total: number;
  onClear: () => void;
}) {
  const term = query.trim();
  if (!term) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
      <span>
        <strong>{count}</strong> resultado(s) para «{term}»
        {total > count ? ` — filtrado de ${total} registro(s)` : ''}
      </span>
      <Button type="button" variant="secondary" className="min-h-9 shrink-0" onClick={onClear}>
        Limpar pesquisa
      </Button>
    </div>
  );
}
