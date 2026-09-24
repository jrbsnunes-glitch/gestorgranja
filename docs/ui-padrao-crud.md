# Padrão de telas CRUD (GestorGranja)

Alinhado ao modelo estrutural do GestorVend; visual Tailwind/emerald.

## Checklist por tela

- [ ] `AdminShell` + `PageIntro` (título + descrição curta)
- [ ] `CrudToolbar` com `CrudSearchFilterLeading` (Pesquisar / Filtros)
- [ ] `SearchModal` + `FilterModal` com `FilterPeriodRangeFields` quando houver datas
- [ ] Listagem via `usePagination` + `PaginatedTable`
- [ ] Incluir/Alterar → `FormCadastroModal`
- [ ] Visualizar → `RecordViewModal` (seções Campo/Valor)
- [ ] Excluir → `ConfirmDeleteModal`
- [ ] Ações por linha: **Alterar / Visualizar / Excluir** (`RowRecordActions`)
- [ ] Relatórios → `ModuleReportsModal` ou `ReportLauncher` (Fase 2)

## Componentes

`apps/web/src/components/crud/`

## Busca e filtros

- Client-side: `useCrudList` + `list-search.ts` + `list-filters.ts`
- Indicador de filtros ativos: botão **Filtros ●**
