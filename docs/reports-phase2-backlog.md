# Relatórios formais — Fase 2 (backlog)

Estrutura alinhada ao GestorVend; implementação após padronização CRUD (Fase 1).

## Frontend

- [`ModuleReportsModal`](../apps/web/src/components/crud/module-reports-modal.tsx) — launcher por módulo (já em uso; conteúdo específico pendente).
- [`StandardReportHeader`](../apps/web/src/components/crud/standard-report-header.tsx) — cabeçalho empresa + carimbo de geração.
- Rota dedicada: `apps/web/src/app/relatorios/impressao/page.tsx` — layout sem `AdminShell`, query string tipada por módulo.
- Libs `apps/web/src/lib/*-report-format.ts` — builders de query (espelhar `product-report-format.ts` do GV).
- CSS impressão: módulo `apps/web/src/styles/reports-print.css` (A4, `no-print` na toolbar).

## API (`apps/api/src/reports/`)

Prioridade sugerida:

1. Estoque / ovos embalados (posição, movimentação)
2. Produção (postura, mortalidade por lote/período)
3. Financeiro (CP/CR abertos, fluxo)
4. RH (ponto, folha resumo)
5. Parceiros

Substituir gradualmente `reports-stub.service.ts` e popup [`/relatorio`](../apps/web/src/app/relatorio/page.tsx).

## Legado

Até a Fase 2, botão **Relatórios** abre modal informativo; **Imprimir** usa `window.print()` na listagem.
