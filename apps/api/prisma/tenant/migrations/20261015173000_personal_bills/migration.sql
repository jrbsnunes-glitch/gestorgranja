-- Agenda pessoal: lançamentos isolados do financeiro e do caixa da granja.

CREATE TYPE "PersonalBillStatus" AS ENUM ('OPEN', 'PAID');

CREATE TABLE "PersonalBill" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "PersonalBillStatus" NOT NULL DEFAULT 'OPEN',
    "installmentIndex" INTEGER,
    "installmentCount" INTEGER,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonalBill_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PersonalBill_userId_dueDate_idx" ON "PersonalBill"("userId", "dueDate");
CREATE INDEX "PersonalBill_userId_status_idx" ON "PersonalBill"("userId", "status");

ALTER TABLE "PersonalBill" ADD CONSTRAINT "PersonalBill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
