'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

export type OperationNatureRow = {
  id: string;
  code: string;
  description: string;
  cfopInternal: string;
  cfopExternal: string;
  isActive?: boolean;
};

function label(n: OperationNatureRow) {
  return `${n.code} — ${n.description} (CFOP ${n.cfopInternal}/${n.cfopExternal})`;
}

export function OperationNatureLookupField({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  required,
  label: fieldLabel = 'Natureza da operação',
  disabled,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, row: OperationNatureRow | null) => void;
  required?: boolean;
  label?: string;
  disabled?: boolean;
}) {
  const [internalId, setInternalId] = useState(defaultValue);
  const selectedId = controlledValue !== undefined ? controlledValue : internalId;

  const setSelectedId = useCallback(
    (id: string, row: OperationNatureRow | null) => {
      if (controlledValue === undefined) setInternalId(id);
      onValueChange?.(id, row);
    },
    [controlledValue, onValueChange],
  );

  const [rows, setRows] = useState<OperationNatureRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(() => {
    void apiFetch<OperationNatureRow[]>('/v1/cadastros/general/operation-natures?activeOnly=1').then(setRows);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (defaultValue && controlledValue === undefined) setInternalId(defaultValue);
  }, [defaultValue, controlledValue]);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.cfopInternal.includes(q) ||
        r.cfopExternal.includes(q),
    );
  }, [rows, query]);

  return (
    <>
      <Field label={fieldLabel}>
        <input type="hidden" name="operationNatureId" value={selectedId} required={required} readOnly />
        <div className="flex gap-2">
          <input
            className={`${inputClass} flex-1 bg-slate-50`}
            readOnly
            value={selected ? label(selected) : ''}
            placeholder="Clique em Pesquisar…"
            disabled={disabled}
          />
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 px-3 py-2 text-sm"
            onClick={() => setSearchOpen(true)}
            disabled={disabled}
          >
            Pesquisar
          </Button>
        </div>
      </Field>

      <FormCadastroModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Natureza da operação"
        size="lg"
        footer={
          <Button type="button" variant="secondary" onClick={() => setSearchOpen(false)}>
            Fechar
          </Button>
        }
      >
        <input
          className={`${inputClass} mb-3`}
          placeholder="Código, descrição ou CFOP…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <ul className="max-h-72 space-y-1 overflow-y-auto text-sm">
          {matches.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left hover:bg-slate-100"
                onClick={() => {
                  setSelectedId(r.id, r);
                  setSearchOpen(false);
                  setQuery('');
                }}
              >
                {label(r)}
              </button>
            </li>
          ))}
          {matches.length === 0 ? <li className="px-2 py-4 text-center text-slate-500">Nenhum registro.</li> : null}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          Cadastre novas naturezas em Cadastros → Natureza da operação.
        </p>
      </FormCadastroModal>
    </>
  );
}
