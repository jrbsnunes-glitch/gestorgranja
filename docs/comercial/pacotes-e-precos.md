# Pacotes e preços (decisão comercial)

## Pacote âncora (oferta principal)

**Pacote B — Profissional**

| Item | Valor |
|------|-------|
| Entrada (única) | **R$ 990** |
| Mensalidade fixa | **R$ 89/mês** |
| Fidelidade mínima | **12 meses** |
| Limites | 5.000 aves, 3 galpões, 5 usuários, 1 CNPJ |

### Variante de entrada (fechada para vendas)

**Narrativa comercial:** a entrada de **R$ 990 inclui as 2 primeiras mensalidades**; a partir do **3º mês** o cliente paga **R$ 89/mês** (demais condições iguais).

Operação de licença:

- Após confirmação da entrada: `licenseStatus = active`
- `licenseExpiresAt` = data da entrada **+ 2 meses** (período coberto pela entrada)
- Renovação mensal: estender `licenseExpiresAt` +1 mês a cada pagamento (script `tenant:license-extend`)

Equivalente contábil: entrada R$ 990 = onboarding + 2× R$ 89; não há mensalidade “zero” eterna.

## Outros pacotes

| Pacote | Entrada | Mensal | Público |
|--------|---------|--------|---------|
| **A — Acesso rápido** | R$ 490 | R$ 69 | Migração planilha; sensível a preço |
| **C — Premium** | R$ 1.490 | R$ 109 | RH/folha desde o dia 1 |
| **Piloto pago** | R$ 290 | R$ 49 (60 dias) | Conversão para B com crédito 100% da entrada |

## Variantes opcionais (contrato)

- **Anual antecipado:** 10× mensalidade na renovação (2 meses de desconto), sem nova entrada.
- **Piloto → B:** crédito integral da entrada do piloto no pacote B.

## Posicionamento

Mensalidade B (R$ 89) reflete **software + onboarding + suporte**, acima de concorrentes “self-service” de R$ 10–30/mês, com escopo maior (RH, caixa, compras, auditoria, multi-usuário).

Minuta: `docs/comercial/minuta-contrato-licenca-saas.md`.
