-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN "pisPasep" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bankCode" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bankAgency" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bankAccount" TEXT;
ALTER TABLE "Employee" ADD COLUMN "bankAccountDigit" TEXT;

-- AlterTable HrSettings
ALTER TABLE "HrSettings" ADD COLUMN "payslipFields" JSONB NOT NULL DEFAULT '{}';

-- AlterTable PayrollRun
ALTER TABLE "PayrollRun" ADD COLUMN "paymentDate" DATE;

-- CreateEnum
CREATE TYPE "PayrollRubricKind" AS ENUM ('EARNING', 'DEDUCTION', 'INFORMATIVE');

-- CreateTable PayrollRubric
CREATE TABLE "PayrollRubric" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "PayrollRubricKind" NOT NULL,
    "natureCode" TEXT NOT NULL,
    "incidenceCp" TEXT NOT NULL DEFAULT '00',
    "incidenceFgts" TEXT NOT NULL DEFAULT '00',
    "incidenceIrrf" TEXT NOT NULL DEFAULT '00',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "validFrom" TEXT,
    "validTo" TEXT,

    CONSTRAINT "PayrollRubric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PayrollRubric_code_key" ON "PayrollRubric"("code");

-- AlterTable PayrollLineItem
ALTER TABLE "PayrollLineItem" ADD COLUMN "rubricId" TEXT;
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_rubricId_fkey" FOREIGN KEY ("rubricId") REFERENCES "PayrollRubric"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed system rubrics
INSERT INTO "PayrollRubric" ("id", "code", "description", "kind", "natureCode", "incidenceCp", "incidenceFgts", "incidenceIrrf", "isSystem") VALUES
(gen_random_uuid()::text, 'SAL_BASE', 'Salário base', 'EARNING', '1000', '11', '11', '11', true),
(gen_random_uuid()::text, 'FERIAS', 'Férias', 'EARNING', '1020', '11', '11', '11', true),
(gen_random_uuid()::text, 'FERIAS_1_3', '1/3 constitucional de férias', 'EARNING', '1020', '11', '11', '11', true),
(gen_random_uuid()::text, 'INSS', 'Contribuição previdenciária (empregado)', 'DEDUCTION', '9201', '00', '00', '09', true),
(gen_random_uuid()::text, 'IRRF', 'Imposto de renda retido na fonte', 'DEDUCTION', '9203', '00', '00', '00', true),
(gen_random_uuid()::text, 'ATESTADO', 'Desconto por atestado médico', 'DEDUCTION', '9207', '00', '00', '00', true),
(gen_random_uuid()::text, 'RET_PROD', 'Retirada de produtos', 'DEDUCTION', '9207', '00', '00', '00', true),
(gen_random_uuid()::text, 'PONTO', 'Desconto por horas não trabalhadas', 'DEDUCTION', '9207', '00', '00', '00', true),
(gen_random_uuid()::text, 'FGTS_PAT', 'FGTS — encargo patronal (informativo)', 'INFORMATIVE', '3501', '00', '00', '00', true)
ON CONFLICT ("code") DO NOTHING;
