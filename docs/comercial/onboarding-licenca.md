# Onboarding comercial e licença (processo manual — Fase 1)

Controle no banco **central** (`Tenant`): `licenseStatus`, `licenseExpiresAt`, `commercialPlan`, limites numéricos.

## Checklist por novo cliente

1. **Proposta assinada** — pacote A/B/C ou piloto; CNPJ e razão social conferidos.
2. **Entrada recebida** — registrar data e forma de pagamento (planilha financeira externa).
3. **Provisionar tenant** — API `POST /v1/provisioning/tenants` ou `pnpm seed:demo` (somente demo).
4. **Ativar licença comercial** — script abaixo (define plano, limites e validade).
5. **Onboarding técnico** — galpões, lotes, import assistido (pacote B/C), treinamento.
6. **Calendário de cobrança** — anotar `billingDay` (padrão: dia 10); renovar licença a cada pagamento.

## Comandos (API)

Na pasta `apps/api`, com `.env` apontando para o central:

```bash
# Ativar após entrada (pacote B: +2 meses incluídos na entrada)
pnpm tenant:license-activate -- granja-xyz package_b --entry-paid 2026-03-10

# Estender +1 mês após mensalidade paga
pnpm tenant:license-extend -- granja-xyz --months 1

# Suspender por inadimplência (>15 dias — decisão comercial)
pnpm tenant:license-activate -- granja-xyz package_b --status suspended

# Consultar tenant
pnpm tenant:license-show -- granja-xyz
```

## Mapeamento status ↔ produto

| Situação | `licenseStatus` | `licenseExpiresAt` |
|----------|-----------------|---------------------|
| Trial / demo | `trial` | +15 dias (trial) |
| Entrada B paga | `active` | entrada + **2 meses** |
| Mensalidade paga | `active` | estender +1 mês a partir do maior entre hoje e vencimento atual |
| Atraso >15 dias | `suspended` | mantém data (não estender até pagar) |
| Cancelamento / fim | `expired` | passado ou data acordada |

Login bloqueado quando `suspended`, `expired` ou `licenseExpiresAt < now` (`TenantService.assertLicenseActive`).

## Piloto → Pacote B

1. Converter contrato; crédito 100% da entrada do piloto no valor da entrada B.
2. Executar `tenant:license-activate` com `package_b` e nova data de entrada.

## Referências

- Preços: `docs/comercial/pacotes-e-precos.md`
- Limites: `docs/comercial/limites-contratuais.md`
- Código: `apps/api/src/commercial/plans.ts`, `apps/api/scripts/tenant-license.ts`
