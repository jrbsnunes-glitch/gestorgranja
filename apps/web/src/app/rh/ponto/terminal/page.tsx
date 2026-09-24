'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal, PageIntro, useCrudList } from '@/components/crud';
import { AdminShell } from '@/components/admin-shell';
import { PunchTerminalQrPanel } from '@/components/punch-terminal-qr-panel';
import { ListToolbar } from '@/components/list-crud';
import { ErrorBox, Field, PageCard, SimpleTable, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

type Terminal = { id: string; name: string; lastSeenAt: string | null; isActive: boolean };

export default function PontoTerminalPage() {
  const [terminals, setTerminals] = useState<Terminal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [quiosquePath, setQuiosquePath] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const list = useCrudList({ items: terminals, searchFields: (t) => [t.name] });

  const load = useCallback(() => {
    void apiFetch<Terminal[]>('/v1/hr/time/terminals').then(setTerminals);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCopyMsg(null);
    if (!selectedId) {
      setQuiosquePath(null);
      return;
    }
    void apiFetch<{ quiosquePath: string }>(`/v1/hr/time/terminals/${selectedId}/kiosk-config`)
      .then((c) => setQuiosquePath(c.quiosquePath))
      .catch(() => setQuiosquePath(null));
  }, [selectedId]);

  async function createTerminal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch('/v1/hr/time/terminals', {
        method: 'POST',
        body: JSON.stringify({ name: fd.get('name') }),
      });
      setFormOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function toggleActive(t: Terminal) {
    setError(null);
    try {
      await apiFetch(`/v1/hr/time/terminals/${t.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (t.isActive && selectedId === t.id) setSelectedId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  async function removeTerminal(t: Terminal) {
    if (!confirm(`Excluir terminal "${t.name}"?`)) return;
    setError(null);
    try {
      await apiFetch(`/v1/hr/time/terminals/${t.id}`, { method: 'DELETE' });
      if (selectedId === t.id) setSelectedId(null);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    }
  }

  const selected = terminals.find((t) => t.id === selectedId);
  const filtered = list.filtered;

  return (
    <AdminShell title="Terminais de ponto">
      <PageIntro
        title="Terminal portaria"
        description="Cadastre terminais, exiba o QR para batida e use o modo portaria em tela cheia no PC da entrada."
      />
      <ErrorBox message={error} />
      <PageCard title="Terminais cadastrados">
        <ListToolbar
          list={list}
          onInclude={() => setFormOpen(true)}
          label="Novo terminal"
          searchPlaceholder="Nome do terminal…"
        />
        <SimpleTable
          headers={['Nome', 'Status', 'Último acesso', 'Ações']}
          rows={filtered.map((t) => [
            t.name,
            t.isActive ? 'Ativo' : 'Inativo',
            t.lastSeenAt ? new Date(t.lastSeenAt).toLocaleString('pt-BR') : '—',
            <span key={t.id} className="flex flex-wrap gap-1">
              <Button
                type="button"
                variant={selectedId === t.id ? undefined : 'secondary'}
                className="px-2 py-1 text-xs"
                onClick={() => setSelectedId(t.id)}
                disabled={!t.isActive}
              >
                {selectedId === t.id ? 'Selecionado' : 'QR'}
              </Button>
              <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => void toggleActive(t)}>
                {t.isActive ? 'Inativar' : 'Ativar'}
              </Button>
              <Button type="button" variant="secondary" className="px-2 py-1 text-xs" onClick={() => void removeTerminal(t)}>
                Excluir
              </Button>
            </span>,
          ])}
        />
      </PageCard>

      {selected?.isActive ? (
        <PageCard title="QR para batida">
          {quiosquePath ? (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                onClick={() => {
                  const url = `${window.location.origin}${quiosquePath}`;
                  void navigator.clipboard.writeText(url).then(
                    () => setCopyMsg('Link do quiosque copiado (tablet na portaria, sem login).'),
                    () => setCopyMsg('Não foi possível copiar — copie manualmente da barra de endereços após abrir.'),
                  );
                }}
              >
                Copiar link quiosque
              </Button>
              <a
                href={quiosquePath}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-sky-700 underline"
              >
                Abrir quiosque
              </a>
              {copyMsg ? <span className="text-xs text-emerald-700">{copyMsg}</span> : null}
            </div>
          ) : null}
          <p className="mb-3 text-xs text-slate-600">
            No tablet da entrada, use o link quiosque (contém segredo do terminal — compartilhe só com a portaria).
          </p>
          <PunchTerminalQrPanel
            terminalId={selected.id}
            terminalName={selected.name}
            kioskHref={quiosquePath ?? `/rh/ponto/terminal/kiosk?terminalId=${selected.id}`}
          />
        </PageCard>
      ) : null}

      <FormCadastroModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Novo terminal"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="terminal-form">
              Salvar
            </Button>
          </>
        }
      >
        <form id="terminal-form" onSubmit={createTerminal}>
          <Field label="Nome">
            <input name="name" className={inputClass} required placeholder="Portaria principal" />
          </Field>
        </form>
      </FormCadastroModal>
    </AdminShell>
  );
}
