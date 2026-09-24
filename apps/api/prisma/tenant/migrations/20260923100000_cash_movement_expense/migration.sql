-- Despesas de caixa (classificação opcional por conta contábil)
ALTER TABLE "CashMovement" ADD COLUMN "isExpense" BOOLEAN NOT NULL DEFAULT false;
