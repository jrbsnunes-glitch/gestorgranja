'use client';

import type { ReactNode } from 'react';
import { CrudSearchFilterLeading } from '@/components/crud/crud-search-filter-leading';
import { CrudToolbar } from '@/components/crud/crud-toolbar';
import { FilterModalActions, FilterPeriodRangeFields } from '@/components/crud/filter-fields';
import { FilterModal } from '@/components/crud/filter-modal';
import { SearchModal } from '@/components/crud/search-modal';
import { SearchResultsBanner } from '@/components/crud/search-results-banner';
import type { useCrudList } from '@/components/crud/use-crud-list';

type ListState = ReturnType<typeof useCrudList<unknown>>;

export function CrudListChrome({
  list,
  onInclude,
  onReports,
  onPrint,
  filterExtra,
  searchPlaceholder,
  showDateFilter = false,
  filtersActive,
  onFilterApply,
  onFilterClear,
}: {
  list: ListState;
  onInclude?: () => void;
  onReports?: () => void;
  onPrint?: () => void;
  filterExtra?: ReactNode;
  searchPlaceholder?: string;
  showDateFilter?: boolean;
  /** Sobrescreve indicador de filtros ativos (ex.: filtros extras além do período). */
  filtersActive?: boolean;
  onFilterApply?: () => void;
  onFilterClear?: () => void;
}) {
  const filtersOn = filtersActive ?? list.filtersActive;
  return (
    <>
      <CrudToolbar
        leadingPrimary={
          <CrudSearchFilterLeading
            onSearch={() => list.setSearchOpen(true)}
            onFilters={() => list.setFilterOpen(true)}
            filtersActive={filtersOn}
            searchActive={Boolean(list.searchQuery.trim())}
          />
        }
        onInclude={onInclude}
        onPrint={onPrint}
        onReports={onReports}
      />
      <SearchModal
        open={list.searchOpen}
        initialQuery={list.searchQuery}
        onClose={() => list.setSearchOpen(false)}
        onApply={list.setSearchQuery}
        placeholder={searchPlaceholder}
        results={list.filtered}
        resultLabel={list.searchResultLabel}
        totalItems={list.totalItems}
      />
      {!list.searchOpen ? (
        <SearchResultsBanner
          query={list.searchQuery}
          count={list.filtered.length}
          total={list.totalItems}
          onClear={() => list.setSearchQuery('')}
        />
      ) : null}
      <FilterModal open={list.filterOpen} onClose={() => list.setFilterOpen(false)}>
        {showDateFilter ? (
          <FilterPeriodRangeFields
            idPrefix="crud"
            from={list.filterDraft.from}
            to={list.filterDraft.to}
            onFromChange={(v) => list.setFilterDraft((d) => ({ ...d, from: v }))}
            onToChange={(v) => list.setFilterDraft((d) => ({ ...d, to: v }))}
          />
        ) : null}
        {filterExtra}
        <FilterModalActions
          onClear={() => {
            list.clearFilters();
            onFilterClear?.();
            list.setFilterOpen(false);
          }}
          onCancel={() => list.setFilterOpen(false)}
          onApply={() => {
            onFilterApply?.();
            list.applyFilters();
          }}
        />
      </FilterModal>
    </>
  );
}
