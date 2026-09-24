# GestorGranja

SaaS multi-tenant para gestão de granjas de postura (avicultura).

## Stack

- Monorepo **pnpm + Turborepo**
- **NestJS** API (REST + OpenAPI) — `apps/api`
- **Next.js** painel admin — `apps/web`
- **PWA** de campo (offline Dexie + Service Worker) — `apps/mobile-pwa`
- PostgreSQL 16 (central + 1 DB por tenant), Redis 7 + BullMQ

## Desenvolvimento rápido

```bash
pnpm install
pnpm docker:up
cd apps/api
# carregar .env da raiz e migrar (já feito na primeira vez)
pnpm seed:demo
# tenant demo já existente, após migration de integração postura→estoque:
pnpm seed:egg-stock:demo
pnpm dev
```

**Postura → estoque:** configure em **Estoque → Integração postura** (produtos `OVO-CARTELA-30` / `OVO-CAIXA-360`). Ao salvar postura, entram movimentos de cartela/caixa; use *Reprocessar* para lançamentos antigos. **Lotes** exibe mortalidade acumulada e aves vivas.

Em outro terminal:

```bash
pnpm --filter @gestor-granja/web dev
pnpm --filter @gestor-granja/mobile-pwa dev
```

**Login demo:** tenant (slug) `demo`, **usuário** `admin`, **senha** `admin123` (e-mail interno: `admin@demo.local`).

Após login, o **menu lateral** inclui: Empresa, Cadastros gerais, Galpões, Lotes, Parceiros, Produtos, Produção, Sanidade, Estoque (movimentações, entradas NF, integração postura), Compras, Vendas, Caixa, RH (funcionários, atestados, férias, folha, ponto QR), Financeiro, Usuários, Alertas, Logs e Sync conflitos.

Após migrations do plano 42 pts: `pnpm permissions:upsert-all` (tenants existentes) e `pnpm tenant:migrate-all`.

- API docs: http://localhost:3010/api/docs
- Web: http://localhost:3020
- Campo PWA: http://localhost:3021

## Novo tenant

```bash
./scripts/new-tenant.sh <slug> <cnpj> "Razão Social" admin@email senha
```

Ver [docs/TENANT-DESIGN.md](docs/TENANT-DESIGN.md).

## Comercial (pequeno produtor)

Pacotes, limites contratuais, minuta e operação de licença: [docs/comercial/](docs/comercial/) — ativação manual via `pnpm --filter @gestor-granja/api tenant:license-activate`.
