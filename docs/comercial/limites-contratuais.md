# Limites contratuais — pequeno produtor

Documento operacional alinhado ao modelo **entrada + mensalidade fixa** (até ~5.000 aves).

## Limites padrão (pacotes A, B e C)

| Recurso | Limite | Como medir no GestorGranja |
|---------|--------|----------------------------|
| Aves alojadas | **5.000** | Soma de `headCount` (ou equivalente) dos **lotes ativos** |
| Galpões | **3** | Registros em **Barn** |
| Usuários | **5** | Contas de **User** com acesso ao tenant (nomeados) |
| CNPJ / tenant | **1** | Um **slug** por CNPJ no banco central |

Trial interno/demo: 500 aves, 1 galpão, 2 usuários (não comercial).

## Política de excesso

1. **Aviso (90%)** — orientar upgrade ou regularização antes de atingir o teto.
2. **Excesso confirmado** — prazo de **30 dias** para contratar add-on ou ajustar cadastro (aves/usuários/galpões).
3. **Sem regularização** — suspensão comercial (`licenseStatus: suspended`) após alinhamento com financeiro; dados preservados conforme contrato.
4. **Add-ons previstos** (cobrança na mensalidade, valores na proposta comercial):
   - Usuário nomeado adicional
   - Galpão extra
   - Segundo CNPJ (novo tenant + contrato)

Enforcement automático nos cadastros é **Fase 2**; na Fase 1 os limites ficam no central (`commercialPlan`, `maxBirds`, `maxBarns`, `maxUsers`) e revisão manual no onboarding/ suporte.

## Referência técnica

Definições em código: `apps/api/src/commercial/plans.ts`.

Campos no tenant central: ver `docs/comercial/onboarding-licenca.md`.
