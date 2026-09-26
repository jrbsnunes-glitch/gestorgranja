'use client';

import { useEffect, useState } from 'react';
import { SimpleTable } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';

type HistoryRow = {
  id: string;
  action: string;
  reason: string | null;
  createdAt: string;
  user: { username: string; name: string } | null;
};

/** Histórico de alterações (auditoria) de um registro operacional. */
export function RecordHistorySection({ entity, id }: { entity: string; id: string }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRows(null);
    setError(null);
    void apiFetch<HistoryRow[]>(`/v1/production/records/${entity}/${id}/history`)
      .then(setRows)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro'));
  }, [entity, id]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!rows) return <p className="text-sm text-slate-500">Carregando histórico…</p>;
  if (!rows.length) return <p className="text-sm text-slate-500">Sem alterações registradas.</p>;

  return (
    <SimpleTable
      headers={['Quando', 'Ação', 'Usuário', 'Justificativa']}
      rows={rows.map((r) => [
        new Date(r.createdAt).toLocaleString('pt-BR'),
        labelEnum(r.action),
        r.user ? r.user.name?.trim() || r.user.username : '—',
        r.reason ?? '—',
      ])}
    />
  );
}
