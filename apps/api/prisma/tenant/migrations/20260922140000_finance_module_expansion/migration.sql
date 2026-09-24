-- AlterEnum
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'RECEIVABLE_OVERDUE';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'CASH_PROJECTION_BELOW_LIMIT';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'BUDGET_PACE_WARNING';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'PURCHASE_CASH_IMPACT';

-- CreateTable FinanceAlertSettings
CREATE TABLE IF NOT EXISTS "FinanceAlertSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "minCashBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "enableReceivableOverdue" BOOLEAN NOT NULL DEFAULT true,
    "enablePaymentDue" BOOLEAN NOT NULL DEFAULT true,
    "enableBudgetPace" BOOLEAN NOT NULL DEFAULT true,
    "enablePurchaseImpact" BOOLEAN NOT NULL DEFAULT true,
    "purchaseImpactThresholdPct" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "budgetPaceWarningPct" DECIMAL(5,2) NOT NULL DEFAULT 85,
    CONSTRAINT "FinanceAlertSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "FinanceAlertSettings" ("id") VALUES ('default') ON CONFLICT DO NOTHING;

-- CreateTable BudgetLine
CREATE TABLE IF NOT EXISTS "BudgetLine" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "chartAccountId" TEXT NOT NULL,
    "amountPlanned" DECIMAL(14,2) NOT NULL,
    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetLine_yearMonth_chartAccountId_key" ON "BudgetLine"("yearMonth", "chartAccountId");
ALTER TABLE "BudgetLine" DROP CONSTRAINT IF EXISTS "BudgetLine_chartAccountId_fkey";
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AccountReceivable
ALTER TABLE "AccountReceivable" ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT;

-- PurchaseQuote / PurchaseOrder
ALTER TABLE "PurchaseQuote" ADD COLUMN IF NOT EXISTS "paymentTermsJson" JSONB;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "paymentTermsJson" JSONB;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "financeApprovedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "financeApprovedByUserId" TEXT;
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "payablesGenerated" BOOLEAN NOT NULL DEFAULT false;
