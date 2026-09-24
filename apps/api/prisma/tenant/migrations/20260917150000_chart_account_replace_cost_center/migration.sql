-- Plano de contas substitui centros de custo

ALTER TABLE "AccountPayable" ADD COLUMN "chartAccountId" TEXT;
ALTER TABLE "AccountReceivable" ADD COLUMN "chartAccountId" TEXT;
ALTER TABLE "StockMovement" ADD COLUMN "chartAccountId" TEXT;
ALTER TABLE "StockReceipt" ADD COLUMN "chartAccountIdNew" TEXT;
ALTER TABLE "EggStockConfig" ADD COLUMN "chartAccountId" TEXT;
ALTER TABLE "CashMovement" ADD COLUMN "chartAccountId" TEXT;

-- Mapeia centro de custo legado → conta contábil (após seed do plano)
UPDATE "AccountPayable" ap
SET "chartAccountId" = ca.id
FROM "CostCenter" cc
JOIN "ChartAccount" ca ON ca.code = CASE cc.code
  WHEN 'PRODUCAO' THEN '4.2'
  WHEN 'ADMIN' THEN '5.1'
  WHEN 'COMMERCIAL' THEN '5.2'
  WHEN 'CONSTRUCTION' THEN '1.2.1.01'
  ELSE '5.1.3'
END
WHERE ap."costCenterId" = cc.id AND ap."chartAccountId" IS NULL;

UPDATE "AccountReceivable" ar
SET "chartAccountId" = ca.id
FROM "CostCenter" cc
JOIN "ChartAccount" ca ON ca.code = CASE cc.code
  WHEN 'COMMERCIAL' THEN '6.1.1'
  ELSE '6.1.1'
END
WHERE ar."costCenterId" = cc.id AND ar."chartAccountId" IS NULL;

UPDATE "StockMovement" sm
SET "chartAccountId" = ca.id
FROM "CostCenter" cc
JOIN "ChartAccount" ca ON ca.code = CASE cc.code
  WHEN 'PRODUCAO' THEN '4.2'
  ELSE '4.2'
END
WHERE sm."costCenterId" = cc.id AND sm."chartAccountId" IS NULL;

UPDATE "StockReceipt" sr
SET "chartAccountIdNew" = ca.id
FROM "CostCenter" cc
JOIN "ChartAccount" ca ON ca.code = '1.1.3.01'
WHERE sr."costCenterId" = cc.id AND sr."chartAccountIdNew" IS NULL;

UPDATE "EggStockConfig" esc
SET "chartAccountId" = (SELECT id FROM "ChartAccount" WHERE code = '4.2' LIMIT 1)
WHERE esc."costCenterId" IS NOT NULL AND esc."chartAccountId" IS NULL;

UPDATE "CashMovement" cm
SET "chartAccountId" = (SELECT id FROM "ChartAccount" WHERE code = '1.1.1.01' LIMIT 1)
WHERE cm."costCenterId" IS NOT NULL AND cm."chartAccountId" IS NULL;

-- Fallback quando não havia CC ou plano ainda vazio: primeira conta analítica compatível
UPDATE "AccountPayable" SET "chartAccountId" = (SELECT id FROM "ChartAccount" WHERE code = '5.1.3' LIMIT 1)
WHERE "chartAccountId" IS NULL;

UPDATE "AccountReceivable" SET "chartAccountId" = (SELECT id FROM "ChartAccount" WHERE code = '6.1.1' LIMIT 1)
WHERE "chartAccountId" IS NULL;

UPDATE "StockMovement" SET "chartAccountId" = (SELECT id FROM "ChartAccount" WHERE code = '4.2' LIMIT 1)
WHERE "chartAccountId" IS NULL;

ALTER TABLE "AccountPayable" DROP CONSTRAINT IF EXISTS "AccountPayable_costCenterId_fkey";
ALTER TABLE "AccountReceivable" DROP CONSTRAINT IF EXISTS "AccountReceivable_costCenterId_fkey";
ALTER TABLE "StockMovement" DROP CONSTRAINT IF EXISTS "StockMovement_costCenterId_fkey";
ALTER TABLE "StockReceipt" DROP CONSTRAINT IF EXISTS "StockReceipt_costCenterId_fkey";
ALTER TABLE "CashMovement" DROP CONSTRAINT IF EXISTS "CashMovement_costCenterId_fkey";

ALTER TABLE "AccountPayable" DROP COLUMN "costCenterId";
ALTER TABLE "AccountReceivable" DROP COLUMN "costCenterId";
ALTER TABLE "StockMovement" DROP COLUMN "costCenterId";
ALTER TABLE "StockReceipt" DROP COLUMN "costCenterId";
ALTER TABLE "StockReceipt" RENAME COLUMN "chartAccountIdNew" TO "chartAccountId";
ALTER TABLE "EggStockConfig" DROP COLUMN "costCenterId";
ALTER TABLE "UserRoleAssignment" DROP COLUMN IF EXISTS "costCenterId";
ALTER TABLE "ConstructionProject" DROP COLUMN IF EXISTS "costCenterId";
ALTER TABLE "ConstructionProject" ADD COLUMN IF NOT EXISTS "chartAccountId" TEXT;

ALTER TABLE "AccountPayable" ALTER COLUMN "chartAccountId" SET NOT NULL;
ALTER TABLE "AccountReceivable" ALTER COLUMN "chartAccountId" SET NOT NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "chartAccountId" SET NOT NULL;

ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_chartAccountId_fkey"
  FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_chartAccountId_fkey"
  FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_chartAccountId_fkey"
  FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_chartAccountId_fkey"
  FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_chartAccountId_fkey"
  FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

DROP TABLE IF EXISTS "CostCenter";
