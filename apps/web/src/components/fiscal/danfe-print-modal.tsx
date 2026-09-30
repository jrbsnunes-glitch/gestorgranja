'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud/form-cadastro-modal';
import { ErrorBox } from '@/components/ui-parts';
import { getApiBase, getToken } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type Props = {
  open: boolean;
  documentId: string | null;
  title?: string;
  onClose: () => void;
};

export function DanfePrintModal({ open, documentId, title, onClose }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    setHtml(null);
    try {
      const token = getToken();
      const res = await fetch(`${getApiBase()}/v1/fiscal/documents/${documentId}/danfe`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Não foi possível carregar a DANFE');
      const text = await res.text();
      setHtml(text);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    if (open && documentId) void load();
    if (!open) {
      setHtml(null);
      setError(null);
    }
  }, [open, documentId, load]);

  function printDanfe() {
    const frame = document.getElementById('danfe-print-frame') as HTMLIFrameElement | null;
    frame?.contentWindow?.print();
  }

  return (
    <FormCadastroModal
      open={open}
      onClose={onClose}
      title={title ?? 'DANFE — impressão'}
      hint="Visualize a nota nesta tela e use Imprimir quando estiver pronto."
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
          <Button type="button" disabled={!html || loading} onClick={() => printDanfe()}>
            Imprimir
          </Button>
        </div>
      }
    >
      <ErrorBox message={error} />
      {loading ? <p className="text-sm text-slate-600">Gerando DANFE…</p> : null}
      {html ? (
        <iframe
          id="danfe-print-frame"
          title="DANFE para impressão"
          className="h-[min(75vh,720px)] w-full rounded-md border border-slate-200 bg-white"
          srcDoc={html}
        />
      ) : null}
    </FormCadastroModal>
  );
}
