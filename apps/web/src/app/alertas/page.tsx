'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, usePagination } from '@/components/list-crud';
import { ErrorBox } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { humanizeUserText } from '@/lib/humanize-user-text';
import { labelEnum } from '@/lib/labels';

type Alert = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
};

export default function AlertasPage() {
  const [rows, setRows] = useState<Alert[]>([]);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);

  const list = useCrudList({
    items: rows,
    searchFields: (a) => [a.type, a.title, a.message, a.status],
    dateField: (a) => a.createdAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const load = useCallback(() => {
    void apiFetch<Alert[]>('/v1/alerts').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function ack(id: string) {
    await apiFetch(`/v1/alerts/${id}/ack`, { method: 'PATCH', body: '{}' });
    load();
  }

  async function runScan() {
    setError(null);
    setScanMsg(null);
    try {
      await apiFetch('/v1/alerts/scan/all', { method: 'POST', body: '{}' });
      setScanMsg('Varredura concluída (CP, estoque, carência).');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao varrer');
    }
  }

  return (
    <AdminShell title="Alertas e pendências">
      <PageIntro
        title="Alertas e pendências"
        description="Pendências detectadas pelo sistema (contas a pagar, estoque, carência). Reconheça ou execute uma nova varredura."
      />
      <ErrorBox message={error} />
      {scanMsg ? <p className="mb-4 text-sm text-emerald-700">{scanMsg}</p> : null}
      <div className="mb-4">
        <Button type="button" onClick={() => void runScan()}>
          Executar varredura de alertas
        </Button>
      </div>
      <ListToolbar
        list={list}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Tipo, título, mensagem…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Tipo', 'Título', 'Mensagem', 'Data', 'Ação']}
        recordItems={slice}
        rows={slice.map((a) => [
          labelEnum(a.type),
          a.title,
          humanizeUserText(a.message),
          new Date(a.createdAt).toLocaleString('pt-BR'),
          a.status === 'OPEN' ? (
            <Button key={a.id} type="button" onClick={() => void ack(a.id)}>
              Reconhecer
            </Button>
          ) : (
            labelEnum(a.status)
          ),
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <ModuleReportsModal open={reportsOpen} title="Alertas" onClose={() => setReportsOpen(false)} compactLauncher />
    </AdminShell>
  );
}
