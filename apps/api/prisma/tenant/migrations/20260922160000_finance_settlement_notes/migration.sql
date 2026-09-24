-- AlterTable
ALTER TABLE "AccountPayable" ADD COLUMN IF NOT EXISTS "settlementNotes" TEXT;

-- AlterTable
ALTER TABLE "AccountReceivable" ADD COLUMN IF NOT EXISTS "settlementNotes" TEXT;
