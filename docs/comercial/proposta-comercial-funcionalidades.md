# Proposta comercial — GestorGranja

**Documento para edição.** Preencha os campos entre colchetes antes de enviar ao cliente.

---

**Proponente:** [Razão social / CNPJ / contato / WhatsApp / e-mail]  
**Cliente:** [Razão social da granja / CNPJ / município-UF]  
**Data da proposta:** [dd/mm/aaaa]  
**Validade:** [30 dias]  
**Pacote sugerido:** [A — Acesso rápido / **B — Profissional** / C — Premium / Piloto]

---

## 1. Apresentação

O **GestorGranja** é um sistema **SaaS (software como serviço)** para **gestão de granjas avícolas de postura**, pensado para o **pequeno e médio produtor** que precisa sair do caderno e da planilha sem contratar um ERP corporativo.

Você acessa pelo **navegador** (computador ou celular), com **dados isolados** da sua granja (multi-tenant: um ambiente exclusivo por cliente). Há ainda um **aplicativo de campo (PWA)** para lançamentos no galpão, inclusive **sem internet**, com sincronização automática quando a conexão voltar.

Esta proposta descreve **o que está disponível hoje** na plataforma, organizado por área de negócio.

---

## 2. Resumo executivo — o que a granja ganha

- **Visão zootécnica diária:** postura, mortalidade, ração e ambiente ligados a **lotes e galpões**, com dashboard comparando desempenho **real × padrão da linhagem**.
- **Operação integrada:** estoque de insumos e ovos embalados, **compras** (requisição → cotação → pedido → recebimento), **vendas** e **caixa**.
- **Financeiro operacional:** contas a pagar e a receber com **plano de contas**, classificação de lançamentos e relatório de **custo de produção** (derivado dos dados da granja).
- **Pessoas:** cadastro de funcionários, afastamentos, férias, **folha simplificada** (INSS/IRRF básicos), **ponto por QR** (portaria + celular).
- **Governança:** usuários com **perfis e permissões**, **alertas** automáticos, **trilha de auditoria** (logs) e revisão de **conflitos de sincronização** do campo.
- **Implantação assistida** (conforme pacote): tenant configurado, treinamento e suporte na entrada — ver seção 8.

---

## 3. Plataforma e segurança

| Item | Descrição |
|------|-----------|
| **Acesso** | Login com identificador da granja (**slug**), usuário e senha; sessão segura (JWT). |
| **Isolamento** | Banco de dados **dedicado por cliente**; dados de outras granjas não se misturam. |
| **Perfis (RBAC)** | Permissões por módulo/ação; possibilidade de restringir usuário a **galpões** específicos. |
| **Auditoria** | Registro de inclusões, alterações, exclusões e emissão de relatórios (**Logs** no menu). |
| **Licenciamento** | Controle comercial de licença (ativo / suspenso / expirado) vinculado ao contrato. |
| **Interface** | Painel web responsivo (menu adaptado a **mobile**); API documentada (OpenAPI). |
| **Campo offline** | PWA instalável; fila local de operações e sync com a nuvem ao reconectar. |

**Hospedagem:** [descrever: cloud / servidor do proponente / SLA acordado — ver minuta de contrato].

---

## 4. Funcionalidades por módulo

### 4.1 Dashboard (indicadores zootécnicos)

- Seleção de **lote** para análise.
- **Idade do lote**, **aves vivas**, mortalidade acumulada.
- **Percentual de postura** atual vs. **curva padrão** da linhagem.
- **Conversão alimentar** (quando há dados de ração).
- Gráfico de evolução da postura no período.
- **Estoque de ovos** embalados (cartelas/caixas) integrado à produção.
- **Custo estimado por dúzia** (indicador gerencial).

---

### 4.2 Cadastros estruturais

**Dados da empresa**

- Razão social, CNPJ e dados cadastrais da unidade produtiva.

**Galpões**

- Código, nome e vínculo operacional (produção, ambiente, lotes).

**Lotes / plantel**

- Lote por galpão: linhagem (**Hy-Line, Lohmann**, etc.), data de alojamento, quantidade alojada, status do ciclo.
- **Aves vivas** e **mortalidade acumulada** exibidas na listagem.
- Observações de plantel, lote do fornecedor, previsão de fim de ciclo.

**Turnos**

- Cadastro de turnos de trabalho (apoio a RH e operação).

**Cadastros gerais**

- Cidades e bairros (endereços de parceiros e funcionários).
- **Bancos** (compe).
- **Situação fiscal** de produtos.
- **Locais de estoque** (depósitos, câmaras, etc.).

**Parceiros**

- Clientes, fornecedores e demais parceiros em cadastro único (comercial e financeiro).

**Produtos e materiais**

- SKU, tipo (ração, medicamento, ovo embalado, insumo, etc.), unidade, estoque mínimo.
- Campos fiscais básicos para operação e NF de entrada.

---

### 4.3 Produção avícola

Tela **Produção** com abas:

**Postura diária**

- Lançamento por lote e data.
- Classificação por **categoria comercial** (extra, grande, médio, pequeno).
- **Perdas** (trincado, sujo, deformado, descarte).
- Peso médio do ovo (opcional).

**Mortalidade**

- Quantidade diária e registro de causa/observação.

**Ração**

- Consumo (kg), sobra e vínculo ao lote.

**Transferência de ração**

- Movimentação de quantidade (kg) **entre lotes**.

**Ambiente**

- Registro por galpão: temperatura, umidade, observações de ventilação (base para futura **IoT**).

**Integração postura → estoque** (Estoque → aba Integração)

- Configuração de produtos **cartela** e **caixa** de ovos.
- Geração automática de movimentos de estoque ao salvar postura.
- **Reprocessamento** de lançamentos antigos após configurar integração.

---

### 4.4 Sanidade e biosseguridade

**Eventos sanitários**

- Vacinas e medicamentos por lote: produto, data, **dias de carência**.
- Cadastro auxiliar de **produtos sanitários** (carência padrão).

**Biosseguridade**

- Registro de visitas: visitante, veículo/placa, finalidade, uso de EPI.

**Alertas**

- Varredura de **carência** antes de comercialização (via motor de alertas).

---

### 4.5 Estoque e suprimentos

**Movimentações**

- Entradas, saídas e ajustes por produto e local.
- Classificação financeira via **plano de contas** em cada movimento.

**Entradas por nota fiscal**

- Registro de recebimento (**StockReceipt**) com itens, quantidades e vínculo a produtos.

**Relatórios de estoque**

- Emissão de relatórios parametrizados (saldo, movimentação — conforme permissão).

---

### 4.6 Compras

Fluxo unificado no painel:

1. **Requisição de compra** (necessidade/descrição).
2. **Cotações** de fornecedores (valores, seleção de vencedor).
3. **Pedido de compra** gerado a partir da requisição.
4. **Recebimento de mercadorias** (integração com estoque).

---

### 4.7 Comercial — vendas e caixa

**Vendas**

- Pedidos de venda, itens e parceiros clientes.

**Caixa**

- Sessões de caixa com fluxo: aberto → **pendente de conciliação** → conciliado.
- Apoio ao controle de entradas/saídas no balcão ou ponto de venda interno.

*Emissão fiscal NF-e/NFC-e na venda:* estrutura preparada; **integração SEFAZ completa** enquadrada como **evolução / serviço à parte** (ver seção 7).

---

### 4.8 Financeiro

**Contas a pagar e a receber**

- Lançamentos com parceiro, vencimento, valor e **status de aprovação**.
- Vínculo ao **plano de contas** (substitui centro de custo legado).

**Plano de contas**

- Estrutura hierárquica para classificar CP, CR, estoque e movimentos.

**Relatório de custos de produção**

- Visão por lote: custos derivados de produção, ração, sanidade e classificações contábeis (**custo por dúzia / por ave** — gerencial).

**Bancos e contas bancárias**

- Cadastro via API/cadastros (base para conciliação futura).

---

### 4.9 Recursos humanos

**Funcionários**

- Cadastro completo (admissão, cargo, salário base, documentos operacionais).

**Atestados / afastamentos**

- Períodos de afastamento vinculados ao colaborador.

**Férias**

- Planejamento e registro de férias.

**Retiradas (folha)**

- Lançamentos de adiantamentos/descontos vinculados à folha.

**Folha de pagamento**

- Competência mensal, cálculo **simplificado** com proventos/descontos, **INSS e IRRF** básicos.
- Visualização detalhada por colaborador.

**Ponto eletrônico (QR)**

- **Terminal de portaria** (web): leitura/registro de batidas.
- **PWA de campo / celular**: registro de ponto pelo funcionário.
- Relatórios de ponto (emissão via módulo de relatórios).

*Observação:* não substitui contador para **eSocial** completo; indicado para operação interna e exportação/orientação contábil.

---

### 4.10 Alertas e pendências

- Listagem de alertas ativos no sistema.
- Geração automática (rotina diária) para, entre outros:
  - contas a pagar próximas do vencimento;
  - produtos **abaixo do estoque mínimo**;
  - **carência sanitária** (sanidade).
- Ação manual de **varredura completa** (administrador).

---

### 4.11 Sistema, usuários e conformidade operacional

**Usuários**

- Criação de logins, perfis e papéis (roles).
- Atribuição de permissões e escopo por galpão.

**Logs (auditoria)**

- Consulta filtrada de ações relevantes no tenant.

**Sync conflitos**

- Fila de operações do campo que exigiram revisão após sincronização offline.

**Anexos de documentos**

- Infraestrutura de anexos vinculáveis a registros (API).

*Módulos com API disponível e telas em evolução:* patrimônio/manutenção, licenças/contratos de compliance, emissor fiscal — consultar roadmap (seção 7).

---

### 4.12 Aplicativo de campo (PWA)

- Instalação no celular (atalho / “app”).
- Login da granja.
- Lançamento de **postura diária** offline.
- Fila de pendências e **sincronização** ao voltar online.
- Indicador online/offline.

*Evolução prevista:* mortalidade e ração offline no mesmo fluxo.

---

## 5. Limites do plano contratado (pequeno produtor)

Preencher conforme pacote vendido (referência padrão **Pacote B**):

| Recurso | Limite |
|---------|--------|
| Aves alojadas (lotes ativos) | até **5.000** |
| Galpões | até **3** |
| Usuários nomeados | até **5** |
| CNPJ / ambiente (tenant) | **1** |

Excesso: política de aviso, prazo para add-on ou upgrade — detalhes em contrato.

---

## 6. Implantação e suporte (conforme pacote)

**Pacote A — Acesso rápido**

- [ ] Tenant criado e empresa configurada  
- [ ] 1 galpão + 1 lote inicial  
- [ ] 1 h treinamento remoto (postura e navegação)

**Pacote B — Profissional (recomendado)**

- [ ] Tudo do pacote A  
- [ ] Import assistido (parceiros, produtos, plano de contas)  
- [ ] Até 3 galpões configurados  
- [ ] 2 h treinamento equipe  
- [ ] 30 dias suporte WhatsApp  

**Pacote C — Premium**

- [ ] Tudo do pacote B  
- [ ] RH modelo (1 funcionário + folha teste)  
- [ ] Integração postura → estoque configurada  
- [ ] 90 dias suporte prioritário  

**Prazo estimado de go-live:** [X dias úteis] após recebimento da entrada e envio dos dados iniciais.

---

## 7. Escopo fora desta proposta (evolução ou sob demanda)

Itens **não incluídos** na licença padrão ou **não finalizados** na versão atual, salvo contratação específica:

- Emissão **NF-e / NFC-e** homologada SEFAZ (certificado A1, contingência, cancelamento).
- **eSocial** e obrigações trabalhistas completas nível contador.
- **IoT** (sensores de ambiente automáticos).
- **Licitações públicas** (módulo plugável).
- Migração de histórico **superior a 12 meses** de planilhas legadas.
- Customizações de código, integrações contábeis proprietárias e BI externo.

---

## 8. Investimento (editar valores e condições)

| | Pacote A | **Pacote B** | Pacote C |
|---|----------|--------------|----------|
| **Entrada (única)** | R$ 490 | **R$ 990** | R$ 1.490 |
| **Mensalidade fixa** | R$ 69/mês | **R$ 89/mês** | R$ 109/mês |
| **Fidelidade mínima** | 12 meses | 12 meses | 12 meses |

**Pacote B — condição comercial sugerida:** entrada de R$ 990 **inclui as 2 primeiras mensalidades**; mensalidade de R$ 89 a partir do 3º mês.

**Forma de pagamento:** [PIX / boleto / transferência] — vencimento mensal dia **[10]**.

**Reajuste anual:** IPCA ou [6]%, o que for menor.

Minuta contratual: `docs/comercial/minuta-contrato-licenca-saas.md`.

---

## 9. Aceite

Declaro ciência do escopo descrito nesta proposta e concordância com os termos comerciais acima.

**Cliente:** _________________________________________  
**CPF/CNPJ:** _________________________________________  
**Data:** ____ / ____ / ______  

**Fornecedor:** _________________________________________  
**Data:** ____ / ____ / ______  

---

*Versão do documento: [1.0] — alinhada ao produto GestorGranja em [mês/ano]. Atualize a seção 7 sempre que novos módulos forem liberados.*
