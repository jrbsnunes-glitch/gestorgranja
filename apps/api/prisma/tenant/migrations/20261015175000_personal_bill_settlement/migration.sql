ALTER TABLE "PersonalBill" ADD COLUMN "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "PersonalBill" ADD COLUMN "settlementNotes" TEXT;
ALTER TABLE "PersonalBill" ADD COLUMN "paymentLabel" TEXT;
