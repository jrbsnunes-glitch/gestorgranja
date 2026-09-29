'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud';
import { PartnerForm, partnerToForm, type PartnerFormValues } from '@/components/partner-form';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';

export type PartnerRole = 'customer' | 'supplier' | 'any';

type PartnerRow = {
  id: string;
  name: string;
  tradeName?: string | null;
  isCustomer?: boolean;
  isSupplier?: boolean;
};

function partnerLabel(p: PartnerRow) {
  return p.tradeName ? `${p.name} (${p.tradeName})` : p.name;
}

function filterByRole(list: PartnerRow[], role: PartnerRole) {
  if (role === 'customer') return list.filter((p) => p.isCustomer);
  if (role === 'supplier') return list.filter((p) => p.isSupplier);
  return list;
}

function createFlags(role: PartnerRole, existing?: PartnerRow) {
  if (role === 'customer') {
    return { isCustomer: true, isSupplier: existing?.isSupplier ?? false };
  }
  if (role === 'supplier') {
    return { isCustomer: existing?.isCustomer ?? false, isSupplier: true };
  }
  return { isCustomer: true, isSupplier: false };
}

export function PartnerLookupField({
  role,
  name = 'partnerId',
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  required,
  label,
  placeholder = 'Clique para pesquisar…',
  disabled,
}: {
  role: PartnerRole;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, partner: PartnerRow | null) => void;
  required?: boolean;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const roleLabel =
    role === 'customer' ? 'cliente' : role === 'supplier' ? 'fornecedor' : 'parceiro';
  const fieldLabel = label ?? (role === 'customer' ? 'Cliente' : role === 'supplier' ? 'Fornecedor' : 'Parceiro');

  const [internalId, setInternalId] = useState(defaultValue);
  const selectedId = controlledValue !== undefined ? controlledValue : internalId;

  const setSelectedId = useCallback(
    (id: string, partner: PartnerRow | null) => {
      if (controlledValue === undefined) setInternalId(id);
      onValueChange?.(id, partner);
    },
    [controlledValue, onValueChange],
  );

  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    void apiFetch<PartnerRow[]>('/v1/cadastros/partners').then(setPartners);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (defaultValue && controlledValue === undefined) setInternalId(defaultValue);
  }, [defaultValue, controlledValue]);

  const pool = useMemo(() => filterByRole(partners, role), [partners, role]);

  const selected = useMemo(
    () => partners.find((p) => p.id === selectedId) ?? pool.find((p) => p.id === selectedId) ?? null,
    [partners, pool, selectedId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? pool.filter((p) => `${p.name} ${p.tradeName ?? ''}`.toLowerCase().includes(q))
      : [...pool].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return list.slice(0, 40);
  }, [pool, query]);

  function pick(p: PartnerRow) {
    setSelectedId(p.id, p);
    setSearchOpen(false);
    setQuery('');
  }

  async function savePartner(values: PartnerFormValues) {
    setCreateError(null);
    try {
      const created = await apiFetch<PartnerRow>('/v1/cadastros/partners', {
        method: 'POST',
        body: JSON.stringify({ ...values, ...createFlags(role) }),
      });
      load();
      pick(created);
      setCreateOpen(false);
      setSearchOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  }

  const display = selected ? partnerLabel(selected) : '';

  return (
    <>
      <Field label={fieldLabel}>
        <input type="hidden" name={name} value={selectedId} required={required && !selectedId} />
        <button
          type="button"
          disabled={disabled}
          className={`${inputClass} flex w-full items-center justify-between gap-2 text-left ${disabled ? 'opacity-60' : ''}`}
          onClick={() => {
            if (!disabled) {
              setQuery('');
              setSearchOpen(true);
            }
          }}
        >
          <span className={display ? 'truncate text-slate-900' : 'truncate text-slate-400'}>
            {display || placeholder}
          </span>
          <span className="shrink-0 text-xs font-medium text-emerald-800">Pesquisar</span>
        </button>
        {selectedId ? (
          <button
            type="button"
            className="mt-1 text-xs text-slate-500 hover:text-slate-800"
            onClick={() => setSelectedId('', null)}
          >
            Limpar seleção
          </button>
        ) : null}
      </Field>

      <FormCadastroModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title={`Pesquisar ${roleLabel}`}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setSearchOpen(false)}>
              Fechar
            </Button>
            <Button
              type="button"
              onClick={() => {
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              Cadastrar novo
            </Button>
          </>
        }
      >
        <Field label="Buscar">
          <input
            className={inputClass}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nome, nome fantasia…"
            autoFocus
          />
        </Field>
        <ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
          {matches.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-slate-500">Nenhum registro encontrado.</li>
          ) : (
            matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2.5 text-left text-sm hover:bg-emerald-50"
                  onClick={() => pick(p)}
                >
                  {partnerLabel(p)}
                </button>
              </li>
            ))
          )}
        </ul>
      </FormCadastroModal>

      <FormCadastroModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={`Incluir ${roleLabel}`}
        wide
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="partner-quick-create">
              Salvar e usar
            </Button>
          </>
        }
      >
        {createError ? <p className="mb-3 text-sm text-red-700">{createError}</p> : null}
        <PartnerForm
          formId="partner-quick-create"
          hideSubmit
          initial={partnerToForm({ personType: role === 'customer' ? 'PF' : 'PJ' })}
          submitLabel="Salvar"
          onSubmit={savePartner}
        />
      </FormCadastroModal>
    </>
  );
}
