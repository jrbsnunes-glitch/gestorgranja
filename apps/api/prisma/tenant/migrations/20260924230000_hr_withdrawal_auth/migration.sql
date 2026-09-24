-- AlterTable
ALTER TABLE "Employee" ADD COLUMN "payrollWithdrawalAuthorizedAt" DATE;
ALTER TABLE "Employee" ADD COLUMN "payrollWithdrawalAuthReference" TEXT;

-- CreateTable
CREATE TABLE "HrSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "productWithdrawalWarnPct" DECIMAL(5,2) NOT NULL DEFAULT 70,
    "requireWithdrawalPayrollAuth" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "HrSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "HrSettings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;
