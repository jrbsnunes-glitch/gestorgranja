-- Grupos de produto, descrição, preço de venda e histórico de preços

CREATE TABLE "ProductGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ProductGroup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductGroup_code_key" ON "ProductGroup"("code");

ALTER TABLE "Product" ADD COLUMN "description" TEXT;
ALTER TABLE "Product" ADD COLUMN "groupId" TEXT;
ALTER TABLE "Product" ADD COLUMN "salePrice" DECIMAL(14,4);

ALTER TABLE "Product" ADD CONSTRAINT "Product_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ProductGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProductPriceHistory" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "salePrice" DECIMAL(14,4) NOT NULL,
    "previousPrice" DECIMAL(14,4),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "userId" TEXT,
    CONSTRAINT "ProductPriceHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProductPriceHistory" ADD CONSTRAINT "ProductPriceHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "ProductPriceHistory_productId_recordedAt_idx" ON "ProductPriceHistory"("productId", "recordedAt" DESC);
