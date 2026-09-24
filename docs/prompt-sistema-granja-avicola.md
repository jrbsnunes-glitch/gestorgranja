# Prompt de Desenvolvimento — Sistema de Gestão para Granja Avícola de Postura (SaaS Multi-Tenant)

## 1. Objetivo

Desenvolver um sistema **SaaS multi-tenant** de gestão para granjas de galinhas poedeiras (avicultura de postura), cobrindo produção avícola, estoque, compras, financeiro, RH, patrimônio, obras, compliance sanitário/fiscal e relatórios gerenciais. O sistema deve funcionar tanto em desktop (painel administrativo completo) quanto em dispositivos móveis (coleta de dados de campo, inclusive **offline**, dado que granjas costumam ter conectividade instável).

Cada tenant representa uma granja (ou grupo de granjas do mesmo proprietário), podendo ter múltiplos galpões/núcleos de produção.

## 2. Stack Tecnológica

- **Monorepo:** Turborepo (apps: `web`, `api`, `mobile-pwa`; packages: `ui`, `database`, `types`, `config`)
- **Backend:** NestJS + Prisma ORM
- **Banco de dados:** PostgreSQL 16 — estratégia **um banco por tenant** (mesmo padrão de provisionamento via script `new-tenant.sh` usado em outros produtos), com schema versionado por migrations Prisma
- **Cache / filas / jobs assíncronos:** Redis 7 + BullMQ (geração de relatórios, cálculo de índices zootécnicos, disparo de alertas, fila de sincronização offline)
- **Frontend web (painel administrativo):** Next.js (App Router) + Tailwind + shadcn/ui
- **Frontend de campo (mobile):** PWA instalável construída sobre o mesmo Next.js — Service Worker + IndexedDB (Dexie.js) + Background Sync API, para lançamento de dados no galpão sem internet e sincronização automática ao reconectar. Alternativa a avaliar apenas se a experiência offline do PWA não for suficiente: app nativo em React Native (Expo) reaproveitando as APIs do NestJS.
- **Fiscal:** módulo de emissão de NF-e/NFC-e na venda de ovos, com certificado digital A1 e integração SEFAZ, seguindo o mesmo padrão de `FiscalIssuerSettings` já validado em outros produtos.
- **Autenticação/autorização:** JWT + RBAC granular por módulo/ação, com suporte a múltiplos perfis por usuário (ex.: um usuário pode ser "operador de campo" em um galpão e "gestor financeiro" em outro).
- **Infra:** Docker Compose (Nginx como proxy reverso com subdomínio wildcard por tenant, Certbot para SSL), com plano de escala Docker Compose → Docker Swarm/Kubernetes conforme número de tenants crescer.
- **Observabilidade:** logs estruturados + auditoria imutável (ver Requisitos Não Funcionais).

## 3. Arquitetura Multi-Tenant

- Um banco de dados PostgreSQL por tenant (isolamento total de dados entre granjas/clientes).
- Script de provisionamento de novo tenant: cria banco, roda migrations, cria usuário admin inicial, configura subdomínio.
- Camada de identificação de tenant via subdomínio (`granjaXYZ.dominio.com.br`) resolvida no Nginx e propagada ao backend via header/JWT claim.
- Dados de configuração global da plataforma (planos, features habilitadas por tenant) ficam em um banco "control-plane" separado.

## 4. Módulos do Sistema (consolidados)

### 4.1 Produção Avícola (núcleo diferenciador)
- **Plantel de aves / Lotes:** cadastro de lote por galpão — linhagem, data de alojamento, quantidade alojada, idade, curva padrão da linhagem (importável por linhagem: Hy-Line, Lohmann, Dekalb, Isa Brown etc.).
- **Produção de ovos:** lançamento diário de postura por lote/galpão, classificação por categoria de peso (extra, grande, médio, pequeno) e por perdas (trincado, sujo, deformado, descarte).
- **Comparativo real vs. padrão:** percentual de postura, peso médio do ovo, massa de ovos, conversão alimentar por dúzia — sempre comparado à curva da linhagem e à média histórica da própria granja.
- **Mortalidade:** lançamento diário com causa, para análise de viabilidade do lote.
- **Descarte de poedeiras** em fim de ciclo como fluxo comercial específico (venda de galinha de descarte).
- **Ração e alimentação:** consumo diário por lote, controle de sobra e transferência entre lotes, conversão alimentar.
- **Sanidade:** calendário vacinal e de medicamentos, com alerta de período de carência antes da venda; biosseguridade (registro de entrada de visitantes/veículos, uso de EPI, barreira sanitária).
- **Controle ambiental por galpão:** temperatura, umidade, ventilação (lançamento manual na v1; estrutura de dados já pronta para ingestão futura via sensores/IoT — endpoint webhook/MQTT gateway).

### 4.2 Estoque e Suprimentos
- **Estoque:** ração, medicamentos, insumos, materiais de obra e materiais de escritório, com centro de custo como dimensão do lançamento (não tela separada).
- **Compras:** módulo único com fluxo interno — requisição → cotação → pedido de compra → recebimento de mercadoria — em vez de 4 telas isoladas.

### 4.3 Financeiro
- **Contas a receber / Contas a pagar**, com fluxo de aprovação de pagamento embutido (não módulo isolado).
- **Bancos** (conciliação) e **Fluxo de caixa** como sub-telas/dashboard do módulo Financeiro.
- **Custos da produção:** relatório computado a partir de produção + ração + sanidade + centro de custo (custo por dúzia de ovos, custo por ave alojada) — não é lançamento manual, é relatório derivado.
- **Fiscal:** emissão de NF-e/NFC-e na venda de ovos.

### 4.4 Comercial
- **Vendas:** pedidos, clientes, tabela de preços por categoria de ovo, integração com emissão fiscal.

### 4.5 Recursos Humanos
- Cadastro de funcionários, escalas e ponto, com atestados/afastamentos e férias como sub-abas (não itens de menu de primeiro nível).
- Folha de pagamento: **fase 2** — priorizar exportação/integração com contabilidade ou eSocial terceirizado em vez de reconstruir do zero no MVP.

### 4.6 Patrimônio e Projetos
- **Patrimônio e Manutenção:** equipamentos (comedouros automáticos, climatização, veículos) e manutenção preventiva/corretiva no mesmo módulo.
- **Projetos/Obras:** construção de novos galpões com orçamento e acompanhamento no mesmo módulo (não 3 telas separadas), com materiais apontados diretamente do Estoque por centro de custo.
- **Frota:** cadastro dentro de Patrimônio, salvo se o cliente tiver frota própria relevante — nesse caso, sub-módulo dedicado.

### 4.7 Compliance e Documentos
- **Licenças e obrigações legais:** registro estadual da granja, dados do responsável técnico (RT/CRMV), licenças ambientais/sanitárias, com alertas de vencimento.
- **Contratos:** fornecedores, clientes, arrendamento, RT.
- **Licitações públicas:** módulo plugável/opcional, fora do MVP, só habilitado para clientes que vendem a órgãos públicos.
- **Documentos:** repositório transversal, anexável a qualquer registro (lote, obra, contrato, funcionário) — não uma pasta isolada.
- **Auditoria e histórico:** log imutável de toda alteração relevante (exigência do RIISPOA para registros sistematizados e auditáveis).

### 4.8 Plataforma
- **Usuários, perfis e permissões** (RBAC granular).
- **Relatórios gerenciais:** motor central que consulta todos os módulos (não um módulo com dados próprios).
- **Alertas e pendências:** motor central único (unifica o que antes eram dois itens duplicados: alertas + central de pendências) — vencimento de licença, período de carência de medicamento, estoque baixo, conta a vencer.
- **Configurações e parâmetros do sistema.**
- **Dashboard principal:** construído em torno dos indicadores zootécnicos (% postura, conversão alimentar, mortalidade, custo por dúzia), não um painel financeiro genérico.

> Nota de arquitetura: "Integração entre módulos" não é um módulo — é um requisito de design. Todos os módulos acima devem compartilhar as mesmas entidades base (lote, galpão, centro de custo, tenant) via um schema Prisma único, evitando dados duplicados entre módulos.

## 5. Requisitos Não Funcionais

- **Offline-first no app de campo:** lançamento de produção/mortalidade/ração deve funcionar sem internet e sincronizar automaticamente ao reconectar, com resolução de conflitos (last-write-wins + log de conflito para revisão manual).
- **Responsivo:** mesma base de código adaptada a desktop, tablet e celular (o painel administrativo completo não precisa ser otimizado para tela pequena; a coleta de campo sim).
- **Auditabilidade:** toda alteração em dados de produção, sanidade e financeiro deve gerar registro imutável (quem, quando, valor anterior/novo) — requisito legal, não só boa prática.
- **Segurança:** RBAC granular por módulo/ação, isolamento total de dados entre tenants, certificado digital A1 protegido para emissão fiscal.
- **LGPD:** dados de RH e de terceiros (visitantes) tratados com base legal e retenção definida.
- **Extensibilidade para IoT:** estrutura de dados de controle ambiental já preparada para receber leituras automáticas de sensores no futuro, sem precisar de migração estrutural.

## 6. Entregáveis Esperados

1. Schema Prisma inicial com todas as entidades do núcleo (tenant, galpão, lote, produção, ração, sanidade, estoque, financeiro, RH, patrimônio, documentos, auditoria).
2. Estrutura de pastas do monorepo Turborepo (`apps/api`, `apps/web`, `apps/mobile-pwa`, `packages/*`).
3. Endpoints REST (ou GraphQL, a definir) do backend NestJS, organizados por módulo, com RBAC aplicado por decorator/guard.
4. Docker Compose de desenvolvimento e de produção, incluindo Nginx com subdomínio wildcard por tenant.
5. Script de provisionamento de novo tenant (`new-tenant.sh`).
6. Protótipo do dashboard principal com os indicadores zootécnicos centrais.
7. Protótipo do fluxo de lançamento de produção offline no PWA de campo.

## 7. Roadmap Sugerido

**Fase 1 — MVP (núcleo avícola + financeiro básico):** Plantel/lotes, produção de ovos, ração, sanidade básica, estoque, compras consolidado, contas a pagar/receber, cadastros gerais, usuários/permissões, dashboard com indicadores zootécnicos, app de campo offline.

**Fase 2:** Patrimônio/manutenção, projetos/obras, licenças e compliance com alertas, auditoria completa, emissão fiscal (NF-e/NFC-e), relatórios gerenciais avançados, custos da produção.

**Fase 3 (opcional/plugável):** Folha de pagamento própria, licitações públicas, frota dedicada, integração com sensores IoT de ambiente e contadores automáticos de ovos.

## 8. Status de implementação (MVP — repo GestorGranja)

| Área | Status |
|------|--------|
| Auth multi-tenant | JWT; login por **slug + username + senha** |
| Produção | Postura (categorias + perdas), mortalidade, ração, ambiente, transferência entre lotes |
| Sanidade | Eventos (vacina/med.) + biosseguridade; alertas de carência (scan) |
| Compras | Requisição → cotação → pedido → recebimento (API + painel web) |
| Estoque / Financeiro | MVP (movimentos, CP/CR) |
| RBAC | Perfis + atribuição com escopo opcional por galpão |
| Auditoria / Logs | Log imutável; menu **Logs**; ações CREATE/UPDATE/DELETE/REPORT |
| Cadastros gerais | Cidades, bairros, bancos, situação fiscal, locais estoque, CC completo |
| Produtos | Menu dedicado; estoque mínimo; campos fiscais básicos |
| Entradas NF | `StockReceipt` + tela Estoque → Entradas |
| RH | Funcionários, atestados, férias, folha simples, ponto QR (portaria + PWA) |
| Vendas / Caixa | Pedidos comerciais; caixa OPEN → PENDING_RECONCILIATION → RECONCILED |
| Alertas | Lista + cron diário (CP, estoque mínimo) + `POST /v1/alerts/scan/all` |
| Dashboard | % postura, mortalidade, conversão, **custo estimado por dúzia** |
| Campo (PWA) | Offline sync (produção); mortalidade/ração offline — evoluir na Sprint B |
| Fiscal / Fase 2 completa | Esboço de módulos; emissão SEFAZ não finalizada |

CI: workflow `.github/workflows/ci.yml` (build API + web).
