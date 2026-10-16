-- AlterTable
ALTER TABLE "SalesOrder" ADD COLUMN "cashTenderedAmount" DECIMAL(14,2),
ADD COLUMN "cashChangeAmount" DECIMAL(14,2),
ADD COLUMN "cashDueAmount" DECIMAL(14,2);
