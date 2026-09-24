# Multi-tenant (GestorGranja)

## Banco central

Tabela `Tenant` (`apps/api/prisma/central/schema.prisma`):

- `slug`: subdomínio / identificador na API
- `cnpj`: âncora comercial
- `databaseName`: PostgreSQL dedicado por granja
- `provisioningStatus`: PENDING → PROVISIONING → READY | FAILED

## Banco por tenant

Schema único em `prisma/tenant/schema.prisma`, aplicado com `prisma migrate deploy` e `TENANT_DATABASE_URL` apontando para o database do cliente.

Runtime: `TenantPrismaService` resolve o tenant pelo slug do JWT, lê `databaseName` no central e monta a URL JDBC.

## Autenticação

`POST /api/v1/auth/login` com `tenantSlug`, `username` e `password`. O e-mail fica só no cadastro interno do usuário. JWT inclui `tenantSlug`, `permissions` e `barnIds` (escopo de galpão).

## Novo tenant

1. `scripts/new-tenant.sh` ou `POST /api/v1/provisioning/tenants`
2. CREATE DATABASE + migrate + seed (`tenant-minimal-seed.ts`)
3. Login com admin inicial

## Fiscal (Fase 2)

Credenciais por tenant em `FiscalIssuerSettings` (padrão GestorVend). Processadores SEFAZ plugáveis via fila Bull.
