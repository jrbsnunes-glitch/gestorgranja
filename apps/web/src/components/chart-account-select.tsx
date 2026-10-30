'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { inputClass } from '@/components/ui-parts';

export type ChartAccountOption = { id: string; code: string; name: string };

type Flow = 'payable' | 'receivable' | 'stock';

type Props = {
  name?: string;
  flow?: Flow;
  required?: boolean;
  defaultValue?: string;
  className?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
};

function sortAccounts(flow: Flow | undefined, rows: ChartAccountOption[]) {
  const list = [...rows];
  if (flow !== 'payable') {
    return list.sort((a, b) => a.code.localeCompare(b.code, 'pt-BR', { numeric: true }));
  }
  const rank = (code: string) => (code.startsWith('4') || code.startsWith('5') ? 0 : 1);
  return list.sort((a, b) => {
    const d = rank(a.code) - rank(b.code);
    if (d) return d;
    return a.code.localeCompare(b.code, 'pt-BR', { numeric: true });
  });
}

function copyFor(flow: Flow | undefined) {
  if (flow === 'receivable') {
    return {
      loading: 'Carregando contas de receita…',
      invalid: 'A lista de contas contábeis veio em formato inesperado.',
      fail: 'Não foi possível carregar as contas contábeis.',
      empty:
        'Nenhuma conta de receita disponível. No plano de contas, a conta precisa estar ativa, analítica e ser de receita (grupo 6).',
      placeholder: '— Selecione a conta contábil —',
    };
  }
  if (flow === 'stock') {
    return {
      loading: 'Carregando contas de estoque…',
      invalid: 'A lista de contas de estoque veio em formato inesperado.',
      fail: 'Não foi possível carregar as contas de estoque.',
      empty: 'Nenhuma conta de estoque disponível no plano de contas.',
      placeholder: '— Selecione a conta —',
    };
  }
  return {
    loading: 'Carregando centros de custo…',
    invalid: 'A lista de centros de custo veio em formato inesperado.',
    fail: 'Não foi possível carregar os centros de custo.',
    empty:
      'Nenhum centro de custo disponível. No plano de contas, a conta precisa estar ativa, analítica e ser de despesa ou custo (grupos 4 e 5).',
    placeholder: '— Selecione o centro de custo —',
  };
}

export function ChartAccountSelect({
  name = 'chartAccountId',
  flow,
  required,
  defaultValue,
  className,
  allowEmpty,
  emptyLabel = '— Selecione —',
}: Props) {
  const [accounts, setAccounts] = useState<ChartAccountOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [value, setValue] = useState(defaultValue ?? '');
  const copy = copyFor(flow);

  useEffect(() => {
    let cancelled = false;
    setAccounts(null);
    setLoadError(null);
    const q = new URLSearchParams();
    if (flow) {
      q.set('flow', flow);
      q.set('posting', '1');
    }
    const suffix = q.toString() ? `?${q.toString()}` : '';
    void apiFetch<ChartAccountOption[]>(`/v1/cadastros/chart-accounts${suffix}`)
      .then((rows) => {
        if (cancelled) return;
        if (!Array.isArray(rows)) {
          setAccounts([]);
          setLoadError(copy.invalid);
          return;
        }
        setAccounts(sortAccounts(flow, rows));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setAccounts([]);
        setLoadError(err instanceof Error ? err.message : copy.fail);
      });
    return () => {
      cancelled = true;
    };
  }, [flow, copy.fail, copy.invalid]);

  useEffect(() => {
    if (!accounts?.length) return;
    if (defaultValue && accounts.some((a) => a.id === defaultValue)) {
      setValue(defaultValue);
    }
  }, [accounts, defaultValue]);

  if (accounts === null) {
    return <p className={`${className ?? inputClass} text-slate-500`}>{copy.loading}</p>;
  }

  if (loadError) {
    return <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>;
  }

  if (accounts.length === 0) {
    return (
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">{copy.empty}</p>
    );
  }

  const placeholder = flow === 'payable' || flow === 'receivable' || flow === 'stock' ? copy.placeholder : emptyLabel;

  return (
    <div>
      <input type="hidden" name={name} value={value} required={required && !value ? true : undefined} />
      <div
        className={`max-h-48 overflow-y-auto rounded-md border border-slate-300 bg-white ${className ?? ''}`}
        role="listbox"
        aria-label={flow === 'receivable' ? 'Conta contábil' : 'Centro de custo'}
      >
        {allowEmpty || !value ? (
          <button
            type="button"
            className={`block w-full px-3 py-2 text-left text-sm ${
              value ? 'text-slate-500 hover:bg-slate-50' : 'bg-slate-50 font-medium text-slate-700'
            }`}
            onClick={() => setValue('')}
          >
            {placeholder}
          </button>
        ) : null}
        {accounts.map((a) => {
          const active = value === a.id;
          return (
            <button
              key={a.id}
              type="button"
              role="option"
              aria-selected={active}
              className={`block w-full px-3 py-2 text-left text-sm ${
                active ? 'bg-emerald-50 font-medium text-emerald-950' : 'text-slate-800 hover:bg-slate-50'
              }`}
              onClick={() => setValue(a.id)}
            >
              {a.code} — {a.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
