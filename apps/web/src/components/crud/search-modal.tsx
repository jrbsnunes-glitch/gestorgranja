'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ModalBackdrop } from '@/components/crud/modal-backdrop';
import { Field, inputClass } from '@/components/ui-parts';
import { Button } from '@gestor-granja/ui';

const PREVIEW_MAX = 15;

export function SearchModal<T>({
  open,
  initialQuery,
  onClose,
  onApply,
  placeholder = 'Buscar na listagem…',
  results,
  resultLabel,
  totalItems,
}: {
  open: boolean;
  initialQuery: string;
  onClose: () => void;
  onApply: (query: string) => void;
  placeholder?: string;
  results: T[];
  resultLabel: (item: T) => string;
  totalItems: number;
}) {
  const [q, setQ] = useState(initialQuery);
  const openedQueryRef = useRef(initialQuery);

  const applyQuery = useCallback(
    (value: string) => {
      onApply(value.trim());
    },
    [onApply],
  );

  useEffect(() => {
    if (open) {
      openedQueryRef.current = initialQuery;
      setQ('');
    }
  }, [open, initialQuery]);

  if (!open) return null;

  const term = q.trim();
  const displayTerm = term || initialQuery.trim();
  const preview = displayTerm ? results.slice(0, PREVIEW_MAX) : [];
  const hiddenCount = displayTerm ? Math.max(0, results.length - preview.length) : 0;

  function handleChange(value: string) {
    setQ(value);
    applyQuery(value);
  }

  function handleClose() {
    applyQuery(q);
    setQ('');
    onClose();
  }

  function handleCancel() {
    applyQuery(openedQueryRef.current);
    setQ('');
    onClose();
  }

  function handleClear() {
    setQ('');
    applyQuery('');
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    handleClose();
  }

  return (
    <ModalBackdrop onClose={handleClose} align="top" wide>
      <form className="p-4 sm:p-5" onSubmit={submit}>
        <h2 className="mb-1 text-lg font-semibold text-slate-900">Pesquisar</h2>
        <p className="mb-3 text-sm text-slate-600">
          Os resultados aparecem aqui e na listagem abaixo. Ao fechar, o campo é limpo e o filtro permanece na tela
          principal.
        </p>
        <Field label="Termo">
          <input
            className={inputClass}
            value={q}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder}
            autoFocus
          />
        </Field>

        <div
          className="mt-4 rounded-md border border-slate-200 bg-slate-50"
          aria-live="polite"
          aria-relevant="additions removals"
        >
          {!displayTerm ? (
            <p className="px-3 py-4 text-sm text-slate-500">Digite um termo para ver os resultados.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-600">Nenhum registro encontrado para «{displayTerm}».</p>
          ) : (
            <>
              <p className="border-b border-slate-200 px-3 py-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                {results.length} resultado(s)
                {totalItems > results.length ? ` · de ${totalItems} no total` : ''}
              </p>
              <ul className="max-h-52 divide-y divide-slate-200 overflow-y-auto">
                {preview.map((item, i) => (
                  <li key={i} className="px-3 py-2.5 text-sm text-slate-800">
                    {resultLabel(item)}
                  </li>
                ))}
              </ul>
              {hiddenCount > 0 ? (
                <p className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
                  + {hiddenCount} outro(s) na listagem principal.
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit">Fechar</Button>
          <Button type="button" variant="secondary" onClick={handleClear}>
            Limpar
          </Button>
          <Button type="button" variant="secondary" onClick={handleCancel}>
            Cancelar
          </Button>
        </div>
      </form>
    </ModalBackdrop>
  );
}
