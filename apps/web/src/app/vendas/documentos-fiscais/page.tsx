'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DanfePrintModal } from '@/components/fiscal/danfe-print-modal';
import { ManualNfeModal } from '@/components/fiscal/manual-nfe-modal';
import { Button } from '@gestor-granja/ui';
import { AdminShell } from '@/components/admin-shell';
import { PageIntro } from '@/components/crud';
import { ResponsiveTableWrap } from '@/components/responsive-table-wrap';
import { ErrorBox, PageCard } from '@/components/ui-parts';
import { apiFetch, getApiBase, getToken } from '@/lib/api';
import { errorMessage } from '@/lib/labels';

type FiscalDoc = {
  id: string;
  type: string;
  model: string | null;
  status: string;
  number: number | null;
  series: number | null;
  accessKey: string | null;
  protocol: string | null;
  xmlStorageKey: string | null;
  errorMessage: string | null;
  salesOrder: { id: string; controlNumber: number; partner: { name: string } } | null;
};

function formatDocControlAndNumber(d: FiscalDoc) {
  const control = d.salesOrder?.controlNumber;
  const hasFiscalNumber = d.series != null && d.number != null;
  return {
    controlLabel: control != null ? `#${control}` : '—',
    numberLabel: hasFiscalNumber ? `Série ${d.series} · Nº ${d.number}` : 'Nº ainda não definido',
  };
}

type Order = {
  id: string;
  controlNumber: number;
  status: string;
  partner: { name: string };
  fiscalDoc: FiscalDoc | null;
};

async function downloadAuth(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${getApiBase()}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error('Falha ao baixar arquivo');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentosFiscaisPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [docs, setDocs] = useState<FiscalDoc[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState<'NFCE' | 'NFE' | null>(null);
  const [manualNfeOpen, setManualNfeOpen] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [sendBusy, setSendBusy] = useState(false);
  const [danfeDocId, setDanfeDocId] = useState<string | null>(null);
  const [consultBusyId, setConsultBusyId] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    void apiFetch<FiscalDoc[]>('/v1/fiscal/documents').then(setDocs);
    void apiFetch<Order[]>('/v1/commercial/orders').then(setOrders);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get('incluir') === '1') {
      setManualNfeOpen(true);
      router.replace('/vendas/documentos-fiscais', { scroll: false });
    }
  }, [searchParams, router]);

  async function emitHomologTest(type: 'NFE' | 'NFCE') {
    if (
      !window.confirm(
        type === 'NFCE'
          ? 'Emitir NFC-e de TESTE em homologação (R$ 1,00)? Exige CSC de homologação configurado.'
          : 'Emitir NF-e de TESTE em homologação (R$ 1,00)?',
      )
    ) {
      return;
    }
    setError(null);
    setTestBusy(type);
    try {
      await apiFetch(`/v1/fiscal/homolog-test-emit?type=${type}`, { method: 'POST', body: '{}' });
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setTestBusy(null);
    }
  }

  async function emit(orderId: string, type: 'NFE' | 'NFCE') {
    setError(null);
    try {
      await apiFetch(`/v1/fiscal/emit/${orderId}?type=${type}`, { method: 'POST', body: '{}' });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function consultDoc(id: string) {
    setError(null);
    setConsultBusyId(id);
    try {
      const res = await apiFetch<{
        ok: boolean;
        cStat?: string;
        message?: string;
        protocol?: string;
        sefazStatus?: string;
        document?: FiscalDoc;
      }>(`/v1/fiscal/documents/${id}/consult`, { method: 'POST', body: '{}' });
      const msg = [res.cStat, res.message].filter(Boolean).join(' — ') || 'Consulta concluída';
      window.alert(`SEFAZ: ${msg}`);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setConsultBusyId(null);
    }
  }

  async function deleteDoc(id: string) {
    if (!window.confirm('Excluir este documento fiscal? Só é permitido para rascunho ou rejeitada.')) return;
    setError(null);
    setDeleteBusyId(id);
    try {
      await apiFetch(`/v1/fiscal/documents/${id}`, { method: 'DELETE' });
      setSelectedDocIds((prev) => prev.filter((x) => x !== id));
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleteBusyId(null);
    }
  }

  async function cancelDoc(id: string) {
    const reason = window.prompt('Justificativa do cancelamento (mín. 15 caracteres):');
    if (!reason || reason.length < 15) return;
    setError(null);
    try {
      await apiFetch(`/v1/fiscal/documents/${id}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const confirmed = orders.filter((o) => o.status === 'CONFIRMED');

  const canSendStatus = (status: string) => status === 'DRAFT' || status === 'REJECTED';

  function toggleDocSelection(id: string, status: string) {
    if (!canSendStatus(status)) return;
    setSelectedDocIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function sendSelectedDocs() {
    if (!selectedDocIds.length) return;
    setError(null);
    setSendBusy(true);
    try {
      for (const id of selectedDocIds) {
        await apiFetch(`/v1/fiscal/documents/${id}/send`, { method: 'POST', body: '{}' });
      }
      setSelectedDocIds([]);
      load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSendBusy(false);
    }
  }

  const editTargetId =
    selectedDocIds.length === 1 &&
    docs.some((d) => d.id === selectedDocIds[0] && canSendStatus(d.status) && d.type === 'NFE')
      ? selectedDocIds[0]
      : null;

  function statusLabel(status: string) {
    switch (status) {
      case 'DRAFT':
        return 'Rascunho';
      case 'PROCESSING':
        return 'Processando';
      case 'AUTHORIZED':
        return 'Autorizada';
      case 'REJECTED':
        return 'Rejeitada';
      case 'CANCELLED':
        return 'Cancelada';
      default:
        return status;
    }
  }

  return (
    <AdminShell title="Documentos fiscais">
      <PageIntro
        title="NF-e / NFC-e"
        description="Emita notas para vendas confirmadas. Homologação AM exige certificado e cadastros fiscais completos."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link href="/empresa/fiscal" className="text-emerald-800 underline">
          Configurar emissor
        </Link>
        <Button type="button" variant="secondary" onClick={() => setManualNfeOpen(true)}>
          Incluir NF-e
        </Button>
      </div>
      <ManualNfeModal
        open={manualNfeOpen || !!editDocId}
        documentId={editDocId}
        onClose={() => {
          setManualNfeOpen(false);
          setEditDocId(null);
        }}
        onSuccess={load}
      />
      <DanfePrintModal
        open={!!danfeDocId}
        documentId={danfeDocId}
        onClose={() => setDanfeDocId(null)}
      />
      <ErrorBox message={error} />

      <PageCard title="Homologação — nota de teste">
        <p className="mb-3 text-sm text-slate-600">
          Gera uma venda de R$ 1,00 e envia à SEFAZ AM (só com ambiente <strong>homologação</strong>, certificado A1 e
          cadastro da empresa completo). NFC-e exige CSC de homologação.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={testBusy !== null}
            onClick={() => void emitHomologTest('NFCE')}
          >
            {testBusy === 'NFCE' ? 'Emitindo NFC-e…' : 'Emitir NFC-e de teste'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={testBusy !== null}
            onClick={() => void emitHomologTest('NFE')}
          >
            {testBusy === 'NFE' ? 'Emitindo NF-e…' : 'Emitir NF-e de teste'}
          </Button>
        </div>
      </PageCard>

      <PageCard title="Vendas confirmadas — emitir" className="mt-6">
        <ResponsiveTableWrap>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-600">
                <th className="px-3 py-2">Pedido</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Fiscal</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {confirmed.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                    Nenhuma venda confirmada.
                  </td>
                </tr>
              ) : (
                confirmed.slice(0, 50).map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 tabular-nums">{o.controlNumber}</td>
                    <td className="px-3 py-2">{o.partner.name}</td>
                    <td className="px-3 py-2">
                      {o.fiscalDoc
                        ? `${o.fiscalDoc.type} · ${o.fiscalDoc.status}${o.fiscalDoc.errorMessage ? ` — ${o.fiscalDoc.errorMessage}` : ''}`
                        : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" onClick={() => void emit(o.id, 'NFCE')}>
                          NFC-e
                        </Button>
                        <Button type="button" variant="secondary" onClick={() => void emit(o.id, 'NFE')}>
                          NF-e
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      </PageCard>

      <PageCard title="Documentos" className="mt-6">
        <p className="mb-4 text-sm text-slate-600">
          Em <strong>homologação</strong>, a nota só foi aceita pela SEFAZ quando o status aparece como{' '}
          <strong>Autorizada</strong> (código interno 100). Aí você verá protocolo e chave de acesso; use{' '}
          <strong>DANFE</strong> abre na tela pronta para impressão; <strong>Consultar</strong> atualiza o status na
          SEFAZ; <strong>Excluir</strong> remove rascunhos e rejeitadas. Em homologação a DANFE traz o aviso
          &quot;SEM VALOR FISCAL&quot; — isso é normal. <strong>Rascunho</strong> ainda não foi transmitido;{' '}
          <strong>Rejeitada</strong> a SEFAZ recusou (veja a mensagem ao lado do status).
        </p>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={!editTargetId}
            onClick={() => editTargetId && setEditDocId(editTargetId)}
          >
            Editar
          </Button>
          <Button
            type="button"
            disabled={sendBusy || selectedDocIds.length === 0}
            onClick={() => void sendSelectedDocs()}
          >
            {sendBusy ? 'Enviando…' : 'Enviar'}
          </Button>
          <span className="text-sm text-slate-500">
            Selecione notas em <strong>Rascunho</strong> ou <strong>Rejeitada</strong>. Use <strong>Editar</strong>{' '}
            (uma por vez) ou <strong>Enviar</strong> à SEFAZ.
          </span>
        </div>
        <ResponsiveTableWrap>
          <table className="w-full min-w-[800px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-600">
                <th className="w-10 px-3 py-2" aria-label="Seleção" />
                <th className="px-3 py-2">Tipo</th>
                <th className="px-3 py-2">Controle · Nº nota</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const selectable = canSendStatus(d.status);
                const selected = selectedDocIds.includes(d.id);
                return (
                <tr
                  key={d.id}
                  className={`border-b border-slate-100 ${selected ? 'bg-emerald-50/80' : ''} ${selectable ? 'cursor-pointer' : ''}`}
                  onClick={() => selectable && toggleDocSelection(d.id, d.status)}
                >
                  <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={!selectable}
                      aria-label={`Selecionar documento ${d.id}`}
                      onChange={() => toggleDocSelection(d.id, d.status)}
                    />
                  </td>
                  <td className="px-3 py-2">{d.type}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {(() => {
                      const { controlLabel, numberLabel } = formatDocControlAndNumber(d);
                      return (
                        <div>
                          <div className="font-medium text-slate-800">Pedido {controlLabel}</div>
                          <div className="text-xs text-slate-500">{numberLabel}</div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <div>{statusLabel(d.status)}</div>
                    {d.status === 'AUTHORIZED' && (d.protocol || d.accessKey) ? (
                      <div className="mt-0.5 text-xs text-slate-500">
                        {d.protocol ? `Protocolo ${d.protocol}` : null}
                        {d.protocol && d.accessKey ? ' · ' : null}
                        {d.accessKey ? `Chave …${d.accessKey.slice(-8)}` : null}
                      </div>
                    ) : null}
                    {d.errorMessage ? (
                      <div className="mt-0.5 text-xs text-amber-800">{d.errorMessage}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{d.salesOrder?.partner.name ?? '—'}</td>
                  <td className="px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex flex-wrap gap-2">
                      {(d.status === 'AUTHORIZED' ||
                        d.status === 'CANCELLED' ||
                        d.status === 'DRAFT' ||
                        d.status === 'REJECTED') && (
                        <Button type="button" variant="secondary" onClick={() => setDanfeDocId(d.id)}>
                          DANFE
                        </Button>
                      )}
                      {(d.accessKey ||
                        d.status === 'PROCESSING' ||
                        d.status === 'AUTHORIZED' ||
                        d.status === 'CANCELLED') && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={consultBusyId === d.id}
                          onClick={() => void consultDoc(d.id)}
                        >
                          {consultBusyId === d.id ? 'Consultando…' : 'Consultar'}
                        </Button>
                      )}
                      {canSendStatus(d.status) && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={deleteBusyId === d.id}
                          onClick={() => void deleteDoc(d.id)}
                        >
                          {deleteBusyId === d.id ? 'Excluindo…' : 'Excluir'}
                        </Button>
                      )}
                      {d.status === 'AUTHORIZED' && (
                        <>
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() =>
                              void downloadAuth(`/v1/fiscal/documents/${d.id}/xml`, `nfe-${d.accessKey ?? d.id}.xml`)
                            }
                          >
                            XML
                          </Button>
                          <Button type="button" variant="secondary" onClick={() => void cancelDoc(d.id)}>
                            Cancelar
                          </Button>
                        </>
                      )}
                      {d.status !== 'AUTHORIZED' && d.xmlStorageKey ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            void downloadAuth(
                              `/v1/fiscal/documents/${d.id}/xml`,
                              `nfe-tentativa-${d.number ?? d.id}.xml`,
                            )
                          }
                        >
                          XML enviado
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </ResponsiveTableWrap>
      </PageCard>
    </AdminShell>
  );
}
