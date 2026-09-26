-- Operação — Etapa 1 (base): status de conferência, responsável, movimentações de aves, galpão, justificativa em auditoria

-- CreateEnum
CREATE TYPE "BarnSituation" AS ENUM ('IN_PRODUCTION', 'EMPTY', 'CLEANING', 'MAINTENANCE');
CREATE TYPE "FlockMovementType" AS ENUM ('ENTRY', 'TRANSFER_IN', 'TRANSFER_OUT', 'EXIT', 'ADJUST', 'CLOSE');
CREATE TYPE "OperationRecordStatus" AS ENUM ('PENDING', 'RECORDED', 'REVIEWED', 'ADJUSTED');

-- AuditLog: justificativa
ALTER TABLE "AuditLog" ADD COLUMN "reason" TEXT;

-- Barn: situação, responsável, observações
ALTER TABLE "Barn"
  ADD COLUMN "situation" "BarnSituation" NOT NULL DEFAULT 'EMPTY',
  ADD COLUMN "responsibleUserId" TEXT,
  ADD COLUMN "notes" TEXT;

UPDATE "Barn" b
SET "situation" = 'IN_PRODUCTION'
WHERE EXISTS (SELECT 1 FROM "FlockLot" l WHERE l."barnId" = b."id" AND l."status" = 'ACTIVE');

-- Registros diários: conferência / responsável
ALTER TABLE "DailyEggProduction"
  ADD COLUMN "discardReason" TEXT,
  ADD COLUMN "status" "OperationRecordStatus" NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "shift" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "DailyMortality"
  ADD COLUMN "status" "OperationRecordStatus" NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "shift" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "DailyFeedConsumption"
  ADD COLUMN "status" "OperationRecordStatus" NOT NULL DEFAULT 'RECORDED',
  ADD COLUMN "shift" TEXT,
  ADD COLUMN "createdByUserId" TEXT,
  ADD COLUMN "reviewedByUserId" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "FlockMovement" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "flockLotId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "FlockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "counterpartLotId" TEXT,
    "reason" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlockMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FlockMovement_controlNumber_key" ON "FlockMovement"("controlNumber");
CREATE INDEX "FlockMovement_flockLotId_date_idx" ON "FlockMovement"("flockLotId", "date");

ALTER TABLE "FlockMovement" ADD CONSTRAINT "FlockMovement_flockLotId_fkey" FOREIGN KEY ("flockLotId") REFERENCES "FlockLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
