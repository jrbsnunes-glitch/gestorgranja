'use client';

import { Button } from '@gestor-granja/ui';

export function CrudSearchFilterLeading({
  onSearch,
  onFilters,
  filtersActive = false,
  searchActive = false,
  searchLabel = 'Pesquisar',
  filtersLabel = 'Filtros',
  filtersTitle,
}: {
  onSearch: () => void;
  onFilters: () => void;
  filtersActive?: boolean;
  searchActive?: boolean;
  searchLabel?: string;
  filtersLabel?: string;
  filtersTitle?: string;
}) {
  return (
    <>
      <Button
        type="button"
        variant={searchActive ? 'primary' : 'secondary'}
        className="min-h-11"
        onClick={onSearch}
        title={searchActive ? 'Pesquisa ativa — clique para alterar' : 'Pesquisar na listagem'}
      >
        {searchLabel}
        {searchActive ? ' ●' : ''}
      </Button>
      <Button
        type="button"
        variant={filtersActive ? 'primary' : 'secondary'}
        className="min-h-11"
        onClick={onFilters}
        title={
          filtersTitle ??
          (filtersActive ? 'Filtros ativos — clique para alterar' : 'Filtrar listagem')
        }
      >
        {filtersLabel}
        {filtersActive ? ' ●' : ''}
      </Button>
    </>
  );
}
