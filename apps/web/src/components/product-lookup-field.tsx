'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@gestor-granja/ui';
import { FormCadastroModal } from '@/components/crud';
import { Field, inputClass } from '@/components/ui-parts';
import { apiFetch } from '@/lib/api';
import { labelEnum, PRODUCT_TYPES } from '@/lib/labels';

export type ProductRow = {
  id: string;
  sku?: string;
  name: string;
  description?: string | null;
  type?: string;
  unit?: string;
  salePrice?: number | null;
};

function productDescription(p: ProductRow) {
  const text = p.description?.trim();
  return text || p.name;
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
  bare = false,
  hideClear = false,
  className = '',
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
  /** Só o campo, sem o rótulo do formulário — para alinhar com botões na mesma linha. */
  bare?: boolean;
  hideClear?: boolean;
  className?: string;
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
  const [editing, setEditing] = useState<ProductRow | null>(null);
  const [query, setQuery] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

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
      ? products.filter((p) =>
          `${productDescription(p)} ${p.name} ${p.unit ?? ''}`.toLowerCase().includes(q),
        )
      : [...products].sort((a, b) =>
          productDescription(a).localeCompare(productDescription(b), 'pt-BR'),
        );
    return list.slice(0, 40);
  }, [products, query]);

  function pick(p: ProductRow | null) {
    setSelectedId(p?.id ?? '', p);
    setSearchOpen(false);
    setQuery('');
  }

  async function saveProduct(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    try {
      const created = await apiFetch<ProductRow>('/v1/inventory/products', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
          description: String(fd.get('description') || '') || undefined,
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
      setFormError(err instanceof Error ? err.message : 'Erro ao cadastrar');
    }
  }

  async function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    const saleRaw = String(fd.get('salePrice') ?? '').trim();
    const salePrice = saleRaw === '' ? null : Number(saleRaw.replace(',', '.'));
    try {
      await apiFetch(`/v1/inventory/products/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: fd.get('name'),
          description: String(fd.get('description') || '') || null,
          unit: fd.get('unit') || 'UN',
          salePrice: salePrice != null && Number.isFinite(salePrice) ? salePrice : null,
        }),
      });
      setEditing(null);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar');
    }
  }

  const display = selected ? productDescription(selected) : '';

  const control = (
    <>
      {name ? (
        <input type="hidden" name={name} value={selectedId} required={required && !selectedId && !allowEmpty} />
      ) : null}
      <button
        type="button"
        disabled={disabled}
        className={`${inputClass} ${className} flex w-full items-center justify-between gap-2 text-left ${disabled ? 'opacity-60' : ''}`}
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
      {!hideClear && (selectedId || allowEmpty) ? (
        <button
          type="button"
          className="mt-1 text-xs text-slate-500 hover:text-slate-800"
          onClick={() => pick(null)}
        >
          Limpar seleção
        </button>
      ) : null}
    </>
  );

  return (
    <>
      {bare ? control : <Field label={label}>{control}</Field>}

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
                setFormError(null);
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
            placeholder="Descrição ou nome…"
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
              <li key={p.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-emerald-50">
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => pick(p)}>
                  <span className="block font-medium text-slate-900">{productDescription(p)}</span>
                  {p.description?.trim() && p.description.trim() !== p.name ? (
                    <span className="block truncate text-xs text-slate-500">{p.name}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="shrink-0 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white"
                  onClick={() => {
                    setFormError(null);
                    setEditing(p);
                  }}
                >
                  Editar
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
        {formError ? <p className="mb-3 text-sm text-red-700">{formError}</p> : null}
        <form id="product-quick-create" onSubmit={saveProduct} className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Nome">
              <input name="name" className={inputClass} required />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Descrição">
              <textarea name="description" rows={2} className={inputClass} placeholder="Texto exibido na pesquisa" />
            </Field>
          </div>
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

      <FormCadastroModal
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Editar produto"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" form="product-quick-edit">
              Salvar
            </Button>
          </>
        }
      >
        {formError ? <p className="mb-3 text-sm text-red-700">{formError}</p> : null}
        {editing ? (
          <form id="product-quick-edit" key={editing.id} onSubmit={saveEdit} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Field label="Nome">
                <input name="name" className={inputClass} required defaultValue={editing.name} />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Descrição">
                <textarea
                  name="description"
                  rows={2}
                  className={inputClass}
                  defaultValue={editing.description ?? ''}
                />
              </Field>
            </div>
            <Field label="Unidade">
              <input name="unit" className={inputClass} defaultValue={editing.unit ?? 'UN'} />
            </Field>
            <Field label="Preço de venda (R$)">
              <input
                name="salePrice"
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                defaultValue={editing.salePrice ?? ''}
              />
            </Field>
          </form>
        ) : null}
      </FormCadastroModal>
    </>
  );
}
