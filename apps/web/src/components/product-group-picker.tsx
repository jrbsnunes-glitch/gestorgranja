'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

export type ProductGroup = { id: string; code: string; name: string };

export function ProductGroupPicker({
  groups,
  groupId,
  onGroupIdChange,
  onGroupCreated,
  label = 'Grupo',
}: {
  groups: ProductGroup[];
  groupId: string;
  onGroupIdChange: (id: string) => void;
  onGroupCreated: (group: ProductGroup) => void;
  label?: string;
}) {
  const selected = groups.find((g) => g.id === groupId);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const g = groups.find((x) => x.id === groupId);
    if (g) setQuery(g.name);
    else if (!groupId) setQuery('');
  }, [groupId, groups]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? groups.filter((g) => `${g.code} ${g.name}`.toLowerCase().includes(q))
      : [...groups].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return list.slice(0, 12);
  }, [groups, query]);

  function pick(g: ProductGroup) {
    onGroupIdChange(g.id);
    setQuery(g.name);
    setOpen(false);
    setCreating(false);
  }

  function clear() {
    onGroupIdChange('');
    setQuery('');
    setOpen(false);
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name.length < 2) {
      setLocalError('Informe o nome do grupo (mín. 2 caracteres).');
      return;
    }
    setBusy(true);
    setLocalError(null);
    try {
      const g = await apiFetch<ProductGroup>('/v1/inventory/product-groups', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      onGroupCreated(g);
      pick(g);
      setNewName('');
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'Erro ao criar grupo');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label}>
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder="Pesquisar grupo ou criar novo…"
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onGroupIdChange('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 180)}
          autoComplete="off"
        />
        {groupId ? (
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
          <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">
            {matches.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(g)}
                >
                  <span className="font-medium">{g.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{g.code}</span>
                </button>
              </li>
            ))}
            <li className="border-t border-slate-100">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm font-medium text-emerald-800 hover:bg-emerald-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setCreating(true);
                  setNewName(query.trim());
                }}
              >
                + Cadastrar novo grupo…
              </button>
            </li>
          </ul>
        ) : null}
      </div>
      {creating ? (
        <form onSubmit={createGroup} className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-700">Novo grupo de produto</p>
          <input
            className={`${inputClass} mb-2`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome do grupo"
            autoFocus
          />
          {localError ? <p className="mb-2 text-xs text-red-700">{localError}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Salvando…' : 'Criar e usar'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}
    </Field>
  );
}
