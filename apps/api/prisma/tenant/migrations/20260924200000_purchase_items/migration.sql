-- Purchase request / quote line items + stock link on receive

CREATE TABLE "PurchaseRequestItem" (
    "id" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,

    CONSTRAINT "PurchaseRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseRequestItem_purchaseRequestId_productId_key" ON "PurchaseRequestItem"("purchaseRequestId", "productId");

ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseRequestItem" ADD CONSTRAINT "PurchaseRequestItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "PurchaseQuoteItem" (
    "id" TEXT NOT NULL,
    "purchaseQuoteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "PurchaseQuoteItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseQuoteItem_purchaseQuoteId_productId_key" ON "PurchaseQuoteItem"("purchaseQuoteId", "productId");

ALTER TABLE "PurchaseQuoteItem" ADD CONSTRAINT "PurchaseQuoteItem_purchaseQuoteId_fkey" FOREIGN KEY ("purchaseQuoteId") REFERENCES "PurchaseQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseQuoteItem" ADD CONSTRAINT "PurchaseQuoteItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PurchaseQuote" ADD COLUMN "partnerId" TEXT;
ALTER TABLE "PurchaseQuote" ADD CONSTRAINT "PurchaseQuote_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StockReceipt" ADD COLUMN "purchaseOrderId" TEXT;
CREATE UNIQUE INDEX "StockReceipt_purchaseOrderId_key" ON "StockReceipt"("purchaseOrderId");
ALTER TABLE "StockReceipt" ADD CONSTRAINT "StockReceipt_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "GoodsReceipt" ADD COLUMN "stockReceiptId" TEXT;
CREATE UNIQUE INDEX "GoodsReceipt_stockReceiptId_key" ON "GoodsReceipt"("stockReceiptId");
ALTER TABLE "GoodsReceipt" ADD CONSTRAINT "GoodsReceipt_stockReceiptId_fkey" FOREIGN KEY ("stockReceiptId") REFERENCES "StockReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE;
