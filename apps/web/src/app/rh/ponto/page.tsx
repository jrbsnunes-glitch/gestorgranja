'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { PunchQrScanner } from '@/components/punch-qr-scanner';
import { HrPunchReportLauncher } from '@/components/hr-punch-report-launcher';
import { ModuleReportsModal, PageIntro, useCrudList } from '@/components/crud';
import { ListToolbar, PaginatedTable, usePagination } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, SubmitButton, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum } from '@/lib/labels';
import { parsePunchQrPayload } from '@/lib/punch-qr';

type Terminal = { id: string; name: string; isActive: boolean };
type Punch = {
  id: string;
  type: string;
  punchedAt: string;
  source: string;
  employee: { name: string };
};

export default function PontoPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [terminalsLoaded, setTerminalsLoaded] = useState(false);
  const [terminalsHint, setTerminalsHint] = useState<string | null>(null);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [terminalId, setTerminalId] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const list = useCrudList({
    items: punches,
    searchFields: (p) => [p.employee.name, p.type, p.source],
    dateField: (p) => p.punchedAt,
  });
  const { slice, page, setPage, totalPages, total } = usePagination(list.filtered);

  const activeTerminals = terminals.filter((t) => t.isActive);

  const load = useCallback(() => {
    void apiFetch<Punch[]>('/v1/hr/time/punches')
      .then(setPunches)
      .catch(() => setPunches([]));

    void apiFetch<Terminal[]>('/v1/hr/time/terminals')
      .then((t) => {
        setTerminals(t);
        setTerminalsHint(null);
        const active = t.filter((x) => x.isActive);
        setTerminalId((prev) => prev || active[0]?.id || '');
        if (t.length > 0 && active.length === 0) {
          setTerminalsHint(
            'Há terminal cadastrado, mas nenhum está ativo. Em RH → Terminal portaria, ative o terminal.',
          );
        }
      })
      .catch((err) => {
        setTerminals([]);
        const text = err instanceof Error ? err.message : 'Erro ao carregar terminais';
        setTerminalsHint(
          `${text} Verifique plano Completo, permissão de ponto (hr.read) e faça login de novo após o RH ajustar o usuário.`,
        );
      })
      .finally(() => setTerminalsLoaded(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submitPunch(terminal: string, tok: string) {
    setSubmitting(true);
    setError(null);
    setMsg(null);
    try {
      const res = await apiFetch<{ type: string; punchedAt: string }>('/v1/hr/time/punch', {
        method: 'POST',
        body: JSON.stringify({ token: tok.trim(), terminalId: terminal, source: 'MOBILE' }),
      });
      setMsg(`Registrado: ${labelEnum(res.type)} em ${new Date(res.punchedAt).toLocaleString('pt-BR')}`);
      setToken('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!terminalId || !token.trim()) return;
    await submitPunch(terminalId, token);
  }

  function applyScanned(data: { terminalId: string; token: string }) {
    setTerminalId(data.terminalId);
    setToken(data.token);
    void submitPunch(data.terminalId, data.token);
  }

  function onTokenPaste(value: string) {
    setToken(value);
    const parsed = parsePunchQrPayload(value);
    if (parsed) {
      setTerminalId(parsed.terminalId);
      setToken(parsed.token);
    }
  }

  const showManualForm = activeTerminals.length > 0;

  return (
    <AdminShell title="Ponto eletrônico">
      <PageIntro
        title="Ponto eletrônico"
        description="Escaneie o QR na portaria (recomendado). O QR já identifica o terminal. É preciso estar logado e vinculado a um funcionário em RH."
      />
      <ErrorBox message={error} />
      {terminalsHint ? <p className="mb-3 text-sm text-amber-800">{terminalsHint}</p> : null}
      {msg ? <p className="mb-4 text-sm text-emerald-700">{msg}</p> : null}
      <div className="mb-6">
        <PageCard title="Registrar batida">
          {terminalsLoaded && activeTerminals.length === 0 && !terminalsHint ? (
            <p className="mb-4 text-sm text-amber-800">
              Nenhum terminal ativo. Peça ao RH para cadastrar e ativar em Terminal portaria e mantenha o QR da
              portaria aberto.
            </p>
          ) : null}

          <PunchQrScanner onScan={applyScanned} onError={(m) => setError(m)} />

          {showManualForm ? (
            <form onSubmit={submit} className="mt-4 max-w-md space-y-3">
              <Field label="Terminal">
                <select
                  className={inputClass}
                  value={terminalId}
                  onChange={(e) => setTerminalId(e.target.value)}
                  required
                >
                  {activeTerminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Código do QR (manual)">
                <input
                  className={inputClass}
                  value={token}
                  onChange={(e) => onTokenPaste(e.target.value)}
                  required
                  placeholder="Cole o JSON ou código do QR"
                  autoComplete="off"
                />
              </Field>
              <SubmitButton label={submitting ? 'Registrando…' : 'Bater ponto'} disabled={submitting} />
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              Use o botão acima para escanear o QR da portaria. Entrada manual exige terminal ativo na lista.
            </p>
          )}
        </PageCard>
      </div>

      <ListToolbar
        list={list}
        onReports={() => setReportsOpen(true)}
        searchPlaceholder="Funcionário, tipo, origem…"
        showDateFilter
      />
      <PaginatedTable
        headers={['Data/hora', 'Funcionário', 'Tipo', 'Origem']}
        recordItems={slice}
        rows={slice.map((p) => [
          new Date(p.punchedAt).toLocaleString('pt-BR'),
          p.employee.name,
          labelEnum(p.type),
          labelEnum(p.source),
        ])}
        page={page}
        totalPages={totalPages}
        total={total}
        onPage={setPage}
      />

      <ModuleReportsModal open={reportsOpen} title="Ponto" onClose={() => setReportsOpen(false)} compactLauncher>
        <HrPunchReportLauncher />
      </ModuleReportsModal>
    </AdminShell>
  );
}
