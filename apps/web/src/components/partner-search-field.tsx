'use client';

import { useEffect, useMemo, useState } from 'react';
import { inputClass } from '@/components/ui-parts';

type Partner = { id: string; name: string; tradeName?: string | null };

/** Campo de pesquisa com lista de parceiros/clientes. */
export function PartnerSearchField({
  partners,
  partnerId,
  label,
  placeholder = 'Digite para pesquisar…',
  onPartnerIdChange,
}: {
  partners: Partner[];
  partnerId: string;
  label: string;
  placeholder?: string;
  onPartnerIdChange: (id: string) => void;
}) {
  const selected = partners.find((p) => p.id === partnerId);
  const [query, setQuery] = useState(selected?.name ?? '');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.name ?? '');
  }, [partnerId, selected?.name]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? partners.filter((p) => {
          const hay = `${p.name} ${p.tradeName ?? ''}`.toLowerCase();
          return hay.includes(q);
        })
      : [...partners].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return list.slice(0, 15);
  }, [partners, query]);

  function pick(p: Partner) {
    onPartnerIdChange(p.id);
    setQuery(p.name);
    setOpen(false);
  }

  function clear() {
    onPartnerIdChange('');
    setQuery('');
    setOpen(false);
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value.trim()) onPartnerIdChange('');
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 150);
          }}
          autoComplete="off"
        />
        {partnerId ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-800"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
          >
            Limpar
          </button>
        ) : null}
        {open && matches.length > 0 ? (
          <ul
            className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
            role="listbox"
          >
            {matches.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(p)}
                >
                  {p.tradeName ? `${p.name} (${p.tradeName})` : p.name}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </label>
  );
}
