-- Formas de pagamento (PDV) e vínculo na venda
CREATE TABLE "PaymentForm" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL DEFAULT '#0f766e',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "PaymentForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentForm_controlNumber_key" ON "PaymentForm"("controlNumber");
CREATE INDEX "PaymentForm_isActive_sortOrder_idx" ON "PaymentForm"("isActive", "sortOrder");

ALTER TABLE "SalesOrder" ADD COLUMN "paymentFormId" TEXT;
ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_paymentFormId_fkey" FOREIGN KEY ("paymentFormId") REFERENCES "PaymentForm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
