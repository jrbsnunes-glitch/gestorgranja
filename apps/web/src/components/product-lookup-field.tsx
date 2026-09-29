'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum, PRODUCT_TYPES } from '@/lib/labels';

export type ProductRow = {
  id: string;
  sku: string;
  name: string;
  type?: string;
  unit?: string;
  salePrice?: number | null;
};

function productLabel(p: ProductRow) {
  return `${p.sku} — ${p.name}`;
}

export function ProductLookupField({
  name = 'productId',
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  required,
  label = 'Produto',
  placeholder = 'Clique para pesquisar…',
  disabled,
  allowEmpty,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (id: string, product: ProductRow | null) => void;
  required?: boolean;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Exibe opção vazia (ex.: produto opcional) */
  allowEmpty?: boolean;
}) {
  const [internalId, setInternalId] = useState(defaultValue);
  const selectedId = controlledValue !== undefined ? controlledValue : internalId;

  const setSelectedId = useCallback(
    (id: string, product: ProductRow | null) => {
      if (controlledValue === undefined) setInternalId(id);
      onValueChange?.(id, product);
    },
    [controlledValue, onValueChange],
  );

  const [products, setProducts] = useState<ProductRow[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(() => {
    void apiFetch<ProductRow[]>('/v1/inventory/products').then(setProducts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (defaultValue && controlledValue === undefined) setInternalId(defaultValue);
  }, [defaultValue, controlledValue]);

  const selected = useMemo(
    () => products.find((p) => p.id === selectedId) ?? null,
    [products, selectedId],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? products.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q))
      : [...products].sort((a, b) => a.sku.localeCompare(b.sku, 'pt-BR'));
    return list.slice(0, 40);
  }, [products, query]);

  function pick(p: ProductRow | null) {
    setSelectedId(p?.id ?? '', p);
    setSearchOpen(false);
    setQuery('');
  }

  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiFetch<ProductRow>('/v1/inventory/products', {
        method: 'POST',
        body: JSON.stringify({
          sku: fd.get('sku'),
          name: fd.get('name'),
          type: fd.get('type') || 'SUPPLY',
          unit: fd.get('unit') || 'UN',
          minStockQty: 0,
        }),
      });
      load();
      pick(created);
      setCreateOpen(false);
      setSearchOpen(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  }

  const display = selected ? productLabel(selected) : '';

  return (
    <>
      <Field label={label}>
        {name ? (
          <input type="hidden" name={name} value={selectedId} required={required && !selectedId && !allowEmpty} />
        ) : null}
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
        {selectedId || allowEmpty ? (
          <button
            type="button"
            className="mt-1 text-xs text-slate-500 hover:text-slate-800"
            onClick={() => pick(null)}
          >
            Limpar seleção
          </button>
        ) : null}
      </Field>

      <FormCadastroModal
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Pesquisar produto"
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
            placeholder="SKU ou nome…"
            autoFocus
          />
        </Field>
        <ul className="mt-3 max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
          {allowEmpty ? (
            <li>
              <button
                type="button"
                className="block w-full px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50"
                onClick={() => pick(null)}
              >
                — Sem produto —
              </button>
            </li>
          ) : null}
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
                  {productLabel(p)}
                </button>
              </li>
            ))
          )}
        </ul>
      </FormCadastroModal>

      <FormCadastroModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Incluir produto"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="product-quick-create">
              Salvar e usar
            </Button>
          </>
        }
      >
        {createError ? <p className="mb-3 text-sm text-red-700">{createError}</p> : null}
        <form id="product-quick-create" onSubmit={saveProduct} className="grid gap-3 sm:grid-cols-2">
          <Field label="SKU">
            <input name="sku" className={inputClass} required />
          </Field>
          <Field label="Nome">
            <input name="name" className={inputClass} required />
          </Field>
          <Field label="Tipo">
            <select name="type" className={inputClass} defaultValue="SUPPLY">
              {PRODUCT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelEnum(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unidade">
            <input name="unit" className={inputClass} defaultValue="UN" />
          </Field>
        </form>
      </FormCadastroModal>
    </>
  );
}
