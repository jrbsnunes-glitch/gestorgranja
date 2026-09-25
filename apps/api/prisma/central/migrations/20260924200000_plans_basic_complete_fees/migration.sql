-- Planos Básico / Completo + valores contratuais livres + limites ilimitados

CREATE TYPE "CommercialPlan_new" AS ENUM ('basic', 'complete');

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "contractEntryFeeBrl" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "contractMonthlyFeeBrl" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "Tenant" ALTER COLUMN "commercialPlan" DROP DEFAULT;

ALTER TABLE "Tenant" ALTER COLUMN "commercialPlan" TYPE "CommercialPlan_new" USING (
  CASE "commercialPlan"::text
    WHEN 'package_b' THEN 'complete'::"CommercialPlan_new"
    WHEN 'package_c' THEN 'complete'::"CommercialPlan_new"
    ELSE 'basic'::"CommercialPlan_new"
  END
);

DROP TYPE "CommercialPlan";
ALTER TYPE "CommercialPlan_new" RENAME TO "CommercialPlan";

ALTER TABLE "Tenant" ALTER COLUMN "commercialPlan" SET DEFAULT 'basic'::"CommercialPlan";

UPDATE "Tenant" SET
  "maxBirds" = 2147483647,
  "maxBarns" = 2147483647,
  "maxUsers" = 2147483647;
