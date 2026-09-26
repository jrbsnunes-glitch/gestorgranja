-- Operação — Etapa 2 (registro operacional): ocorrências, consumo de insumos, perdas

-- CreateEnum
CREATE TYPE "SupplyMovementKind" AS ENUM ('CONSUMPTION', 'LOSS', 'ADJUST', 'TRANSFER', 'RETURN');
CREATE TYPE "OperationalLossType" AS ENUM ('EGG', 'FEED', 'SUPPLY', 'BIRD', 'EQUIPMENT', 'OTHER');
CREATE TYPE "OccurrenceType" AS ENUM ('EQUIPMENT', 'WATER', 'POWER', 'ROUTINE', 'ENVIRONMENT', 'LOSS_INCREASE', 'PRODUCTION_ANOMALY', 'SANITARY', 'OTHER');
CREATE TYPE "OccurrencePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "OccurrenceStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');

-- DailyFeedConsumption: vínculo com produto/estoque
ALTER TABLE "DailyFeedConsumption"
  ADD COLUMN "productId" TEXT,
  ADD COLUMN "stockLocationId" TEXT,
  ADD COLUMN "stockSyncedKg" DECIMAL(12,3) NOT NULL DEFAULT 0;

ALTER TABLE "DailyFeedConsumption" ADD CONSTRAINT "DailyFeedConsumption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyFeedConsumption" ADD CONSTRAINT "DailyFeedConsumption_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable SupplyConsumption
CREATE TABLE "SupplyConsumption" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "barnId" TEXT,
    "flockLotId" TEXT,
    "productId" TEXT NOT NULL,
    "stockLocationId" TEXT,
    "kind" "SupplyMovementKind" NOT NULL DEFAULT 'CONSUMPTION',
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "notes" TEXT,
    "stockSyncedQty" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "status" "OperationRecordStatus" NOT NULL DEFAULT 'RECORDED',
    "createdByUserId" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SupplyConsumption_controlNumber_key" ON "SupplyConsumption"("controlNumber");
CREATE INDEX "SupplyConsumption_date_idx" ON "SupplyConsumption"("date");
CREATE INDEX "SupplyConsumption_productId_date_idx" ON "SupplyConsumption"("productId", "date");

ALTER TABLE "SupplyConsumption" ADD CONSTRAINT "SupplyConsumption_barnId_fkey" FOREIGN KEY ("barnId") REFERENCES "Barn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplyConsumption" ADD CONSTRAINT "SupplyConsumption_flockLotId_fkey" FOREIGN KEY ("flockLotId") REFERENCES "FlockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupplyConsumption" ADD CONSTRAINT "SupplyConsumption_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplyConsumption" ADD CONSTRAINT "SupplyConsumption_stockLocationId_fkey" FOREIGN KEY ("stockLocationId") REFERENCES "StockLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable OperationalLoss
CREATE TABLE "OperationalLoss" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "type" "OperationalLossType" NOT NULL,
    "barnId" TEXT,
    "flockLotId" TEXT,
    "productId" TEXT,
    "location" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'UN',
    "reason" TEXT,
    "actionTaken" TEXT,
    "notes" TEXT,
    "estimatedCost" DECIMAL(14,2),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalLoss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalLoss_controlNumber_key" ON "OperationalLoss"("controlNumber");
CREATE INDEX "OperationalLoss_date_idx" ON "OperationalLoss"("date");
CREATE INDEX "OperationalLoss_type_date_idx" ON "OperationalLoss"("type", "date");

ALTER TABLE "OperationalLoss" ADD CONSTRAINT "OperationalLoss_barnId_fkey" FOREIGN KEY ("barnId") REFERENCES "Barn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalLoss" ADD CONSTRAINT "OperationalLoss_flockLotId_fkey" FOREIGN KEY ("flockLotId") REFERENCES "FlockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalLoss" ADD CONSTRAINT "OperationalLoss_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable OperationalOccurrence
CREATE TABLE "OperationalOccurrence" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "barnId" TEXT,
    "flockLotId" TEXT,
    "type" "OccurrenceType" NOT NULL DEFAULT 'OTHER',
    "location" TEXT,
    "description" TEXT NOT NULL,
    "priority" "OccurrencePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'OPEN',
    "actionTaken" TEXT,
    "resolverUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "assetId" TEXT,
    "maintenanceRecordId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalOccurrence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OperationalOccurrence_controlNumber_key" ON "OperationalOccurrence"("controlNumber");
CREATE UNIQUE INDEX "OperationalOccurrence_maintenanceRecordId_key" ON "OperationalOccurrence"("maintenanceRecordId");
CREATE INDEX "OperationalOccurrence_status_priority_idx" ON "OperationalOccurrence"("status", "priority");
CREATE INDEX "OperationalOccurrence_occurredAt_idx" ON "OperationalOccurrence"("occurredAt");

ALTER TABLE "OperationalOccurrence" ADD CONSTRAINT "OperationalOccurrence_barnId_fkey" FOREIGN KEY ("barnId") REFERENCES "Barn"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalOccurrence" ADD CONSTRAINT "OperationalOccurrence_flockLotId_fkey" FOREIGN KEY ("flockLotId") REFERENCES "FlockLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalOccurrence" ADD CONSTRAINT "OperationalOccurrence_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OperationalOccurrence" ADD CONSTRAINT "OperationalOccurrence_maintenanceRecordId_fkey" FOREIGN KEY ("maintenanceRecordId") REFERENCES "MaintenanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
