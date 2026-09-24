-- CreateEnum
CREATE TYPE "RecurringFinanceKind" AS ENUM ('PAYABLE', 'RECEIVABLE');

-- CreateTable
CREATE TABLE "RecurringFinanceRule" (
    "id" TEXT NOT NULL,
    "kind" "RecurringFinanceKind" NOT NULL,
    "partnerId" TEXT NOT NULL,
    "chartAccountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringFinanceRule_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RecurringFinanceRule" ADD CONSTRAINT "RecurringFinanceRule_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RecurringFinanceRule" ADD CONSTRAINT "RecurringFinanceRule_chartAccountId_fkey" FOREIGN KEY ("chartAccountId") REFERENCES "ChartAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AccountPayable" ADD COLUMN "recurringRuleId" TEXT;
ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringFinanceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AccountPayable_recurringRuleId_dueDate_idx" ON "AccountPayable"("recurringRuleId", "dueDate");

ALTER TABLE "AccountReceivable" ADD COLUMN "recurringRuleId" TEXT;
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringFinanceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "AccountReceivable_recurringRuleId_dueDate_idx" ON "AccountReceivable"("recurringRuleId", "dueDate");
