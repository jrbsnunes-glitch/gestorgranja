-- Situação fiscal: tributação do item (NCM, CST, IBS/CBS)
ALTER TABLE "ProductFiscalSituation" ADD COLUMN IF NOT EXISTS "ncm" TEXT;
ALTER TABLE "ProductFiscalSituation" ADD COLUMN IF NOT EXISTS "cest" TEXT;
ALTER TABLE "ProductFiscalSituation" ADD COLUMN IF NOT EXISTS "fiscalCst" TEXT;
ALTER TABLE "ProductFiscalSituation" ADD COLUMN IF NOT EXISTS "ibsCst" TEXT;
ALTER TABLE "ProductFiscalSituation" ADD COLUMN IF NOT EXISTS "ibsClassTrib" TEXT;

-- Natureza da operação (CFOP)
CREATE TABLE IF NOT EXISTS "OperationNature" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cfopInternal" TEXT NOT NULL,
    "cfopExternal" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "OperationNature_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OperationNature_code_key" ON "OperationNature"("code");

ALTER TABLE "SalesOrderItem" ADD COLUMN IF NOT EXISTS "operationNatureId" TEXT;

DO $$ BEGIN
  ALTER TABLE "SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_operationNatureId_fkey"
    FOREIGN KEY ("operationNatureId") REFERENCES "OperationNature"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO "OperationNature" ("id", "code", "description", "cfopInternal", "cfopExternal", "isActive")
VALUES
  ('f1a10001-0000-4000-8000-000000000001', 'VENDA-5102', 'Venda de produção do estabelecimento', '5102', '6102', true),
  ('f1a10001-0000-4000-8000-000000000002', 'VENDA-5101', 'Venda de produção do estabelecimento (diferimento)', '5101', '6101', true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "ProductFiscalSituation" ("id", "code", "description", "ncm", "fiscalCst", "ibsCst", "ibsClassTrib", "isActive")
VALUES (
  'f1a20001-0000-4000-8000-000000000001',
  'OVOS-AM',
  'Ovos frescos — referência AM (validar com contador)',
  '04072100',
  '102',
  '200',
  '200022',
  true
)
ON CONFLICT ("code") DO UPDATE SET
  "ncm" = COALESCE("ProductFiscalSituation"."ncm", EXCLUDED."ncm"),
  "fiscalCst" = COALESCE("ProductFiscalSituation"."fiscalCst", EXCLUDED."fiscalCst"),
  "ibsCst" = COALESCE("ProductFiscalSituation"."ibsCst", EXCLUDED."ibsCst"),
  "ibsClassTrib" = COALESCE("ProductFiscalSituation"."ibsClassTrib", EXCLUDED."ibsClassTrib");

UPDATE "ProductFiscalSituation" fs SET
  "ncm" = COALESCE(fs."ncm", src."ncm"),
  "cest" = COALESCE(fs."cest", src."cest"),
  "fiscalCst" = COALESCE(fs."fiscalCst", src."fiscalCst")
FROM (
  SELECT DISTINCT ON ("fiscalSituationId")
    "fiscalSituationId",
    "ncm",
    "cest",
    "fiscalCst"
  FROM "Product"
  WHERE "fiscalSituationId" IS NOT NULL
    AND ("ncm" IS NOT NULL OR "cest" IS NOT NULL OR "fiscalCst" IS NOT NULL)
  ORDER BY "fiscalSituationId", "controlNumber"
) src
WHERE fs."id" = src."fiscalSituationId";

UPDATE "Product" SET "fiscalSituationId" = 'f1a20001-0000-4000-8000-000000000001'
WHERE "fiscalSituationId" IS NULL
  AND ("ncm" IS NOT NULL OR "fiscalCst" IS NOT NULL OR "cfopInternal" IS NOT NULL);

ALTER TABLE "Product" DROP COLUMN IF EXISTS "ncm";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "cfopInternal";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "cfopExternal";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "cest";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "fiscalCst";
