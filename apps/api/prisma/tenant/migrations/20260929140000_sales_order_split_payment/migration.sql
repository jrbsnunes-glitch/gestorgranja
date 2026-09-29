-- Pagamento dividido na venda (até duas formas)
ALTER TABLE "SalesOrder" ADD COLUMN "primaryPaymentAmount" DECIMAL(14,2);
ALTER TABLE "SalesOrder" ADD COLUMN "secondaryPaymentFormId" TEXT;

ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_secondaryPaymentFormId_fkey"
  FOREIGN KEY ("secondaryPaymentFormId") REFERENCES "PaymentForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
