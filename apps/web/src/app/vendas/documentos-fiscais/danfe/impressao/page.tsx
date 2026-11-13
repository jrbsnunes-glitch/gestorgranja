'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { DanfeNfeDocument, type DanfeNfePayload } from '@/components/fiscal/danfe-nfe-document';
import { apiFetch, getApiBase, getToken } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

function DanfeImpressaoInner() {
  const params = useSearchParams();
  const id = params.get('id');
  const preview = params.get('preview') === '1';
  const [data, setData] = useState<DanfeNfePayload | null>(null);
  const [nfceHtml, setNfceHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (preview) {
      const raw = sessionStorage.getItem('gg-danfe-preview');
      if (!raw) {
        setError('Pré-visualização expirada. Gere de novo.');
        return;
      }
      try {
        setData(JSON.parse(raw) as DanfeNfePayload);
      } catch {
        setError('Pré-visualização inválida.');
      }
      return;
    }
    if (!id) {
      setError('Nota não informada.');
      return;
    }
    void apiFetch<{ model: string; payload?: DanfeNfePayload }>(`/v1/fiscal/documents/${id}/danfe-view`)
      .then(async (view) => {
        if (view.model === '65') {
          const token = getToken();
          const res = await fetch(`${getApiBase()}/v1/fiscal/documents/${id}/danfe`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (!res.ok) throw new Error('Não foi possível carregar a DANFE');
          setNfceHtml(await res.text());
          return;
        }
        if (!view.payload) throw new Error('DANFE indisponível');
        setData(view.payload);
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id, preview]);

  if (nfceHtml) {
    return (
      <iframe
        title="DANFE NFC-e"
        className="h-screen w-full border-0 bg-white"
        srcDoc={nfceHtml}
      />
    );
  }

  return (
    <div className="danfe-nfe-page">
      <style>{'@media print { .no-print { display: none !important; } }'}</style>
      {error ? <p className="no-print p-6 text-sm text-red-700">{error}</p> : null}
      {!error && !data ? <p className="no-print p-6 text-sm text-slate-600">Gerando DANFE…</p> : null}
      {data ? <DanfeNfeDocument data={data} /> : null}
    </div>
  );
}

export default function DanfeImpressaoPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-slate-600">Gerando DANFE…</p>}>
      <DanfeImpressaoInner />
    </Suspense>
  );
}
