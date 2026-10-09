'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

export type BarnOption = { id: string; code: string; name: string; isActive?: boolean };
export type LineageOption = { id: string; code: string; name: string };

function suggestCodeFromName(name: string) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function SearchCreateLookupField<T extends { id: string; code: string; name: string }>({
  label,
  name,
  required,
  valueId,
  onValueIdChange,
  items,
  placeholder,
  createTitle,
  onCreate,
}: {
  label: string;
  name: string;
  required?: boolean;
  valueId: string;
  onValueIdChange: (id: string) => void;
  items: T[];
  placeholder?: string;
  createTitle: string;
  onCreate: (payload: { code: string; name: string }) => Promise<T>;
}) {
  const selected = items.find((x) => x.id === valueId);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [draftName, setDraftName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (selected) setQuery(`${selected.code} — ${selected.name}`);
    else if (!valueId) setQuery('');
  }, [valueId, selected]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter((x) => `${x.code} ${x.name}`.toLowerCase().includes(q))
      : [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return list.slice(0, 14);
  }, [items, query]);

  function pick(item: T) {
    onValueIdChange(item.id);
    setQuery(`${item.code} — ${item.name}`);
    setOpen(false);
    setCreating(false);
    setLocalError(null);
  }

  function clear() {
    onValueIdChange('');
    setQuery('');
    setOpen(false);
  }

  function startCreate() {
    const name = query.includes('—') ? query.split('—').pop()?.trim() ?? query.trim() : query.trim();
    setDraftName(name);
    setDraftCode(suggestCodeFromName(name));
    setCreating(true);
    setLocalError(null);
  }

  async function submitCreate() {
    const code = draftCode.trim();
    const itemName = draftName.trim();
    if (code.length < 1 || itemName.length < 2) {
      setLocalError('Informe código e nome (mín. 2 caracteres no nome).');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const created = await onCreate({ code, name: itemName });
      pick(created);
      setDraftCode('');
      setDraftName('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label}>
      <input type="hidden" name={name} value={valueId} required={required && !valueId} />
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder={placeholder ?? 'Pesquisar ou cadastrar novo…'}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onValueIdChange('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 200)}
          autoComplete="off"
        />
        {valueId ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
          >
            Limpar
          </button>
        ) : null}
        {open && !creating ? (
          <ul className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {matches.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">Nenhum resultado.</li>
            ) : (
              matches.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(item)}
                  >
                    <span className="font-medium">{item.name}</span>
                    <span className="ml-2 text-xs text-slate-500">{item.code}</span>
                  </button>
                </li>
              ))
            )}
            <li className="border-t border-slate-100">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={startCreate}
              >
                + Cadastrar novo…
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      {creating ? (
        <div
          className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              void submitCreate();
            }
          }}
        >
          <p className="mb-2 text-xs font-medium text-slate-700">{createTitle}</p>
          <label className="mb-2 block text-xs text-slate-600">
            Código
            <input
              className={`${inputClass} mt-1`}
              value={draftCode}
              onChange={(e) => setDraftCode(e.target.value.toUpperCase())}
              placeholder="Ex.: GAL-02"
              autoFocus
            />
          </label>
          <label className="mb-2 block text-xs text-slate-600">
            Nome
            <input
              className={`${inputClass} mt-1`}
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Nome de exibição"
            />
          </label>
          {localError ? <p className="mb-2 text-xs text-red-700">{localError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={busy} onClick={() => void submitCreate()}>
              {busy ? 'Salvando…' : 'Criar e usar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </Field>
  );
}

export function BarnLookupField({
  barns,
  barnId,
  onBarnIdChange,
  onBarnCreated,
}: {
  barns: BarnOption[];
  barnId: string;
  onBarnIdChange: (id: string) => void;
  onBarnCreated: (barn: BarnOption) => void;
}) {
  const activeBarns = useMemo(() => barns.filter((b) => b.isActive !== false), [barns]);

  return (
    <SearchCreateLookupField
      label="Galpão"
      name="barnId"
      required
      valueId={barnId}
      onValueIdChange={onBarnIdChange}
      items={activeBarns}
      placeholder="Pesquisar galpão ou cadastrar novo…"
      createTitle="Novo galpão"
      onCreate={async (payload) => {
        const barn = await apiFetch<BarnOption>('/v1/cadastros/barns', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onBarnCreated(barn);
        return barn;
      }}
    />
  );
}

export function BreedLineageLookupField({
  lineages,
  lineageId,
  onLineageIdChange,
  onLineageCreated,
}: {
  lineages: LineageOption[];
  lineageId: string;
  onLineageIdChange: (id: string) => void;
  onLineageCreated: (lineage: LineageOption) => void;
}) {
  return (
    <SearchCreateLookupField
      label="Linhagem"
      name="breedLineageId"
      required
      valueId={lineageId}
      onValueIdChange={onLineageIdChange}
      items={lineages}
      placeholder="Pesquisar linhagem ou cadastrar nova…"
      createTitle="Nova linhagem"
      onCreate={async (payload) => {
        const lineage = await apiFetch<LineageOption>('/v1/cadastros/breed-lineages', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        onLineageCreated(lineage);
        return lineage;
      }}
    />
  );
}
