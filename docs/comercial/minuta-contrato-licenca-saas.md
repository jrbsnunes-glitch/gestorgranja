# Minuta — Contrato de licença de uso SaaS GestorGranja

> Modelo para pequeno produtor avícola (postura). Revisar com advogado antes de assinatura. Substituir campos entre `[colchetes]`.

---

## CONTRATO DE LICENÇA DE USO DE SOFTWARE COMO SERVIÇO (SaaS)

**CONTRATADA:** [Razão social], CNPJ [•], endereço [•], doravante **FORNECEDORA**.

**CONTRATANTE:** [Razão social da granja], CNPJ [•], endereço [•], doravante **CLIENTE**.

As partes celebram o presente contrato, regido pelas cláusulas abaixo.

### CLÁUSULA 1 — Objeto

1.1. Licença de uso não exclusiva, intransferível e não sublicenciável do sistema **GestorGranja** (painel web, API e PWA de campo), em modalidade **SaaS multi-tenant**, incluindo hospedagem e backups conforme SLA descrito no Anexo I.

1.2. Pacote contratado: **[A / B / C / Piloto]** — conforme `docs/comercial/pacotes-e-precos.md` vigente na data de assinatura.

1.3. Limites do plano: até **[5.000]** aves alojadas, **[3]** galpões, **[5]** usuários nomeados, **[1]** CNPJ (tenant). Excesso sujeito à política do Anexo II.

### CLÁUSULA 2 — Valores e forma de pagamento

2.1. **Taxa de entrada (setup/onboarding):** R$ **[990,00]**, paga na assinatura ou em até **[5]** dias úteis, via **[PIX / boleto / transferência]**.

2.2. **Mensalidade fixa:** R$ **[89,00]**, vencimento todo dia **[10]** de cada mês.

2.3. **Pacote B (quando aplicável):** a entrada de R$ 990 **inclui as duas primeiras mensalidades**; a mensalidade de R$ 89 passa a ser devida a partir do **terceiro mês** de vigência.

2.4. A entrada é **não reembolsável** após início do onboarding (criação do tenant e sessão de configuração).

2.5. Serviços fora do escopo (NF-e produção, integração contábil, migração histórica superior a 12 meses, customizações) serão orçados à parte.

### CLÁUSULA 3 — Vigência e fidelidade

3.1. Vigência mínima de **[12]** meses contados da **data de ativação** da licença (`[data]`).

3.2. Rescisão antecipada pelo CLIENTE: multa equivalente ao **saldo residual** das mensalidades do período de fidelidade, ou **[30]%** das mensalidades restantes — o que for **menor**, salvo acordo escrito.

3.3. Renovação automática por períodos sucessivos de 12 meses, salvo aviso prévio de **[30]** dias antes do término.

### CLÁUSULA 4 — Reajuste

4.1. Anualmente, na data de aniversário do contrato, a mensalidade poderá ser reajustada pelo **IPCA/IBGE** acumulado nos últimos 12 meses, ou por **[6]%** fixo, **o que for menor**, salvo negociação expressa.

### CLÁUSULA 5 — Licenciamento e suspensão por inadimplência

5.1. A FORNECEDORA controla o acesso mediante status de licença no ambiente (`active`, `suspended`, `expired`).

5.2. Atraso superior a **[15]** dias no pagamento da mensalidade autoriza a **suspensão** do acesso até a regularização, sem prejuízo da cobrança dos valores devidos.

5.3. Após **[90]** dias de inadimplência, a licença poderá ser marcada como **expirada** e os dados tratados conforme Cláusula 8.

5.4. Durante suspensão, o CLIENTE não poderá exportar dados pela interface, salvo solicitação formal por e-mail (exportação em até **[5]** dias úteis após quitação ou encerramento).

### CLÁUSULA 6 — Suporte

6.1. Canal: **[WhatsApp comercial / e-mail suporte@•]** em dias úteis, **[9h–18h]**.

6.2. Pacote B: até **[2]** horas de treinamento remoto na implantação + **[30]** dias de suporte orientativo via WhatsApp. Pacote C: **[90]** dias prioritários.

### CLÁUSULA 7 — Obrigações do CLIENTE

7.1. Fornecer dados verídicos, manter confidencialidade de credenciais e utilizar o sistema conforme legislação aplicável (LGPD, trabalhista, fiscal).

7.2. Não realizar engenharia reversa, scraping abusivo ou compartilhamento de login entre usuários além do limite contratado.

### CLÁUSULA 8 — Dados e encerramento

8.1. Os dados inseridos pelo CLIENTE permanecem de sua titularidade.

8.2. Em caso de encerramento, a FORNECEDORA disponibilizará exportação (**CSV** ou formato acordado) em até **[30]** dias após solicitação.

8.3. Retenção em backup: **[90]** dias após encerramento, salvo obrigação legal em contrário.

### CLÁUSULA 9 — Limitação de responsabilidade

9.1. O software é ferramenta de gestão; decisões zootécnicas, fiscais e trabalhistas são de responsabilidade do CLIENTE e de seus consultores.

9.2. Limitação de danos indiretos conforme legislação aplicável; SLA de disponibilidade conforme Anexo I.

### CLÁUSULA 10 — Foro

Foro da comarca de **[cidade/UF]**, com renúncia a qualquer outro.

---

**Local e data:** ____________________

**FORNECEDORA** ____________________

**CLIENTE** ____________________

---

### ANEXO I — SLA (resumo)

- Disponibilidade alvo: **[99,5%]** mensal (exceto manutenção programada).
- Backups: **[diários]**, retenção **[7–30]** dias.
- Manutenção programada: aviso prévio **[24h]**.

### ANEXO II — Política de excesso de limites

Conforme `docs/comercial/limites-contratuais.md`: aviso em 90% do limite, prazo de 30 dias para add-on ou ajuste, possibilidade de suspensão comercial se não regularizado.
