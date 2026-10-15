'use client';

import { Button } from '@gestor-granja/ui';
import { inputClass } from '@/components/ui-parts';

export type FinanceStatusTab = 'todos' | 'aberto' | 'pagos' | 'vencidos';

export type FinancePeriodPreset = 'custom' | 'month' | 'next7';

const STATUS_TABS: { id: FinanceStatusTab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'aberto', label: 'Em aberto' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'vencidos', label: 'Vencidos' },
];

export function FinanceTitlesToolbar({
  statusTab,
  onStatusTabChange,
  searchQuery,
  onSearchQueryChange,
  searchPlaceholder,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onFilterApply,
  onRefresh,
  periodPreset,
  onPeriodPresetChange,
}: {
  statusTab: FinanceStatusTab;
  onStatusTabChange: (tab: FinanceStatusTab) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  searchPlaceholder: string;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onFilterApply: () => void;
  onRefresh: () => void;
  periodPreset?: FinancePeriodPreset;
  onPeriodPresetChange?: (preset: FinancePeriodPreset) => void;
}) {
  return (
    <div className="mb-4 space-y-3">
      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onStatusTabChange(t.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              statusTab === t.id
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-end">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Pesquisar</span>
          <span className="relative block">
            <svg
              viewBox="0 0 24 24"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Zm5.5-2.2L20 20"
                strokeLinecap="round"
              />
            </svg>
            <input
              className={`${inputClass} pl-9`}
              value={searchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              placeholder={searchPlaceholder}
            />
          </span>
        </label>
        {onPeriodPresetChange ? (
          <label className="w-full sm:w-44">
            <span className="mb-1 block text-xs text-slate-500">Período</span>
            <select
              className={inputClass}
              value={periodPreset ?? 'custom'}
              onChange={(e) => onPeriodPresetChange(e.target.value as FinancePeriodPreset)}
            >
              <option value="month">Mês atual</option>
              <option value="next7">Próximos 7 dias</option>
              <option value="custom">Personalizado</option>
            </select>
          </label>
        ) : null}
        <label className="w-full sm:w-40">
          <span className="mb-1 block text-xs text-slate-500">Data inicial</span>
          <input
            type="date"
            className={inputClass}
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
        </label>
        <label className="w-full sm:w-40">
          <span className="mb-1 block text-xs text-slate-500">Data final</span>
          <input
            type="date"
            className={inputClass}
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </label>
        <div className="relative z-10 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onFilterApply();
            }}
          >
            Filtrar
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRefresh();
            }}
          >
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  );
}
