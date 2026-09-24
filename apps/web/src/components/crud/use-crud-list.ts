'use client';

import { useCallback, useMemo, useState } from 'react';
import { dateInInclusiveRange, dateRangeActive, type DateRangeFilter, EMPTY_DATE_RANGE } from '@/lib/list-filters';
import { matchesListSearch } from '@/lib/list-search';

export function useCrudList<T>({
  items,
  searchFields,
  dateField,
  extraFilter,
}: {
  items: T[];
  searchFields: (item: T) => Array<string | null | undefined>;
  dateField?: (item: T) => string;
  extraFilter?: (item: T, applied: { dateRange: DateRangeFilter }) => boolean;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterDraft, setFilterDraft] = useState<DateRangeFilter>(EMPTY_DATE_RANGE);
  const [filterApplied, setFilterApplied] = useState<DateRangeFilter>(EMPTY_DATE_RANGE);

  const filtersActive = dateRangeActive(filterApplied);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (!matchesListSearch(searchFields(item), searchQuery)) return false;
      if (dateField && filtersActive && !dateInInclusiveRange(dateField(item), filterApplied.from, filterApplied.to)) {
        return false;
      }
      if (extraFilter && !extraFilter(item, { dateRange: filterApplied })) return false;
      return true;
    });
  }, [items, searchFields, searchQuery, dateField, filterApplied, filtersActive, extraFilter]);

  const searchResultLabel = useCallback(
    (item: unknown) => {
      const parts = searchFields(item as T)
        .map((v) => (v == null ? '' : String(v).trim()))
        .filter(Boolean);
      return parts.slice(0, 4).join(' · ') || '—';
    },
    [searchFields],
  );

  return {
    filtered,
    totalItems: items.length,
    searchResultLabel,
    searchQuery,
    setSearchQuery,
    searchOpen,
    setSearchOpen,
    filterOpen,
    setFilterOpen,
    filterDraft,
    setFilterDraft,
    filterApplied,
    filtersActive,
    applyFilters: () => {
      setFilterApplied(filterDraft);
      setFilterOpen(false);
    },
    clearFilters: () => {
      setFilterDraft(EMPTY_DATE_RANGE);
      setFilterApplied(EMPTY_DATE_RANGE);
    },
  };
}
