-- CreateEnum
CREATE TYPE "HazardPayType" AS ENUM ('NONE', 'INSALUBRIO', 'PERICULOSIDADE');

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN "hazardPayType" "HazardPayType" NOT NULL DEFAULT 'NONE';
ALTER TABLE "Employee" ADD COLUMN "insalubrityPct" INTEGER NOT NULL DEFAULT 20;
ALTER TABLE "Employee" ADD COLUMN "monthlyWorkHours" INTEGER NOT NULL DEFAULT 220;
ALTER TABLE "Employee" ADD COLUMN "vtOptIn" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable PayrollRubric
ALTER TABLE "PayrollRubric" ADD COLUMN "integratesInss" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PayrollRubric" ADD COLUMN "integratesFgts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "PayrollRubric" ADD COLUMN "integratesIrrf" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable PayrollLine
ALTER TABLE "PayrollLine" ADD COLUMN "payrollBaseDisplay" DECIMAL(14,2);
ALTER TABLE "PayrollLine" ADD COLUMN "otHours50" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD COLUMN "otHours100" DECIMAL(8,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD COLUMN "commissionAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PayrollLine" ADD COLUMN "ajudaCustoAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- Seed new rubrics
INSERT INTO "PayrollRubric" ("id", "code", "description", "kind", "natureCode", "incidenceCp", "incidenceFgts", "incidenceIrrf", "isSystem", "integratesInss", "integratesFgts", "integratesIrrf") VALUES
(gen_random_uuid()::text, 'INSALUB', 'Adicional de insalubridade', 'EARNING', '1030', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'PERIC', 'Adicional de periculosidade', 'EARNING', '1030', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'HE_50', 'Hora extra (50%)', 'EARNING', '1003', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'HE_100', 'Hora extra (100%)', 'EARNING', '1003', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'DSR_HE', 'DSR sobre horas extras', 'EARNING', '1000', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'DSR_COM', 'DSR sobre comissões', 'EARNING', '1000', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'COMISS', 'Comissão', 'EARNING', '1010', '11', '11', '11', true, true, true, true),
(gen_random_uuid()::text, 'AJUDA_CUSTO', 'Ajuda de custo', 'EARNING', '1899', '00', '00', '00', true, false, false, false),
(gen_random_uuid()::text, 'VT', 'Vale-transporte (6% salário)', 'DEDUCTION', '9207', '00', '00', '00', true, false, false, false)
ON CONFLICT ("code") DO NOTHING;

UPDATE "PayrollRubric" SET "integratesInss" = false, "integratesFgts" = false, "integratesIrrf" = false WHERE "code" = 'AJUDA_CUSTO';
