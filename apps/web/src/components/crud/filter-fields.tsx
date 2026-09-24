'use client';

import { inputClass } from '@/components/ui-parts';

export function FilterPeriodRangeFields({
  idPrefix,
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel = 'Período de',
  toLabel = 'Período até',
}: {
  idPrefix: string;
  from: string;
  to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
  fromLabel?: string;
  toLabel?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{fromLabel}</span>
        <input
          id={`${idPrefix}-from`}
          type="date"
          className={inputClass}
          value={from}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{toLabel}</span>
        <input
          id={`${idPrefix}-to`}
          type="date"
          className={inputClass}
          value={to}
          onChange={(e) => onToChange(e.target.value)}
        />
      </label>
    </div>
  );
}

export function FilterProductGroupField({
  idPrefix,
  groupId,
  groups,
  onGroupIdChange,
}: {
  idPrefix: string;
  groupId: string;
  groups: { id: string; code: string; name: string }[];
  onGroupIdChange: (id: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-slate-600">Grupo</span>
      <select
        id={`${idPrefix}-group`}
        className={inputClass}
        value={groupId}
        onChange={(e) => onGroupIdChange(e.target.value)}
      >
        <option value="">Todos os grupos</option>
        {groups.map((g) => (
          <option key={g.id} value={g.id}>
            {g.code} — {g.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function FilterControlRangeFields({
  idPrefix,
  controlMin,
  controlMax,
  onControlMinChange,
  onControlMaxChange,
  minLabel = 'Controle mín.',
  maxLabel = 'Controle máx.',
}: {
  idPrefix: string;
  controlMin: string;
  controlMax: string;
  onControlMinChange: (v: string) => void;
  onControlMaxChange: (v: string) => void;
  minLabel?: string;
  maxLabel?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{minLabel}</span>
        <input
          id={`${idPrefix}-cmin`}
          inputMode="numeric"
          className={inputClass}
          value={controlMin}
          onChange={(e) => onControlMinChange(e.target.value)}
          placeholder="Opc."
        />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block text-slate-600">{maxLabel}</span>
        <input
          id={`${idPrefix}-cmax`}
          inputMode="numeric"
          className={inputClass}
          value={controlMax}
          onChange={(e) => onControlMaxChange(e.target.value)}
          placeholder="Opc."
        />
      </label>
    </div>
  );
}

export function FilterModalActions({
  onClear,
  onCancel,
  onApply,
}: {
  onClear: () => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        className="min-h-11 rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50"
        onClick={onClear}
      >
        Limpar
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50"
        onClick={onCancel}
      >
        Cancelar
      </button>
      <button
        type="button"
        className="min-h-11 rounded-md bg-emerald-700 px-4 text-sm font-medium text-white hover:bg-emerald-800"
        onClick={onApply}
      >
        Aplicar
      </button>
    </div>
  );
}
