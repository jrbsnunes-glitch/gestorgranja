CREATE TABLE "FinanceExpenseType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconKey" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FinanceExpenseType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceExpenseType_name_key" ON "FinanceExpenseType"("name");

ALTER TABLE "AccountPayable" ADD COLUMN "expenseTypeId" TEXT;

CREATE INDEX "AccountPayable_expenseTypeId_idx" ON "AccountPayable"("expenseTypeId");

ALTER TABLE "AccountPayable" ADD CONSTRAINT "AccountPayable_expenseTypeId_fkey" FOREIGN KEY ("expenseTypeId") REFERENCES "FinanceExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
