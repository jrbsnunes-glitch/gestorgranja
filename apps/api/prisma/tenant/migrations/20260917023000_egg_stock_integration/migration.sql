-- AlterEnum
ALTER TYPE "ProductType" ADD VALUE 'PACKAGED_EGG';

-- CreateTable
CREATE TABLE "EggProductionStockLedger" (
    "id" TEXT NOT NULL,
    "dailyEggProductionId" TEXT NOT NULL,
    "commercialEggs" INTEGER NOT NULL,
    "cartonsQty" DECIMAL(14,3) NOT NULL,
    "boxesQty" DECIMAL(14,3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EggProductionStockLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EggStockConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "eggsPerCarton" INTEGER NOT NULL DEFAULT 30,
    "cartonsPerBox" INTEGER NOT NULL DEFAULT 12,
    "syncCartons" BOOLEAN NOT NULL DEFAULT true,
    "syncBoxes" BOOLEAN NOT NULL DEFAULT true,
    "cartonProductId" TEXT,
    "boxProductId" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "EggStockConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EggProductionStockLedger_dailyEggProductionId_key" ON "EggProductionStockLedger"("dailyEggProductionId");

-- AddForeignKey
ALTER TABLE "EggProductionStockLedger" ADD CONSTRAINT "EggProductionStockLedger_dailyEggProductionId_fkey" FOREIGN KEY ("dailyEggProductionId") REFERENCES "DailyEggProduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
