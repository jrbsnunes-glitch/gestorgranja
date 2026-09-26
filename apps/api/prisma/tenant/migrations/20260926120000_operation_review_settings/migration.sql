-- Etapa 3/4 Operação: configurações do módulo, alertas operacionais.

-- Novos tipos de alerta
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'PRODUCTION_BELOW_STANDARD';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'FEED_VARIATION';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'PENDING_RECORDS';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'OPEN_OCCURRENCE';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'LOSS_ABOVE_LIMIT';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'MORTALITY_ABOVE_LIMIT';

-- Alert: critério, prioridade, responsável e contexto
ALTER TABLE "Alert"
  ADD COLUMN IF NOT EXISTS "criteria" TEXT,
  ADD COLUMN IF NOT EXISTS "priority" "OccurrencePriority",
  ADD COLUMN IF NOT EXISTS "assigneeUserId" TEXT,
  ADD COLUMN IF NOT EXISTS "barnId" TEXT,
  ADD COLUMN IF NOT EXISTS "flockLotId" TEXT;

-- Modo de sincronização de consumo com o estoque
DO $$ BEGIN
  CREATE TYPE "ConsumptionSyncMode" AS ENUM ('ON_REVIEW', 'ON_RECORD', 'OFF');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "OperationSettings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "consumptionSyncMode" "ConsumptionSyncMode" NOT NULL DEFAULT 'ON_REVIEW',
  "eggSyncOnlyReviewed" BOOLEAN NOT NULL DEFAULT false,
  "stockChartAccountId" TEXT,
  "enableProductionBelowStandard" BOOLEAN NOT NULL DEFAULT true,
  "productionBelowStandardPct" DECIMAL(5,2) NOT NULL DEFAULT 5,
  "enableFeedVariation" BOOLEAN NOT NULL DEFAULT true,
  "feedVariationPct" DECIMAL(5,2) NOT NULL DEFAULT 15,
  "enablePendingRecords" BOOLEAN NOT NULL DEFAULT true,
  "pendingRecordsAfterHour" INTEGER NOT NULL DEFAULT 9,
  "enableOpenOccurrence" BOOLEAN NOT NULL DEFAULT true,
  "openOccurrenceMinPriority" "OccurrencePriority" NOT NULL DEFAULT 'HIGH',
  "openOccurrenceMaxHours" INTEGER NOT NULL DEFAULT 24,
  "enableLossAboveLimit" BOOLEAN NOT NULL DEFAULT true,
  "lossAboveLimitPct" DECIMAL(5,2) NOT NULL DEFAULT 3,
  "enableMortalityAboveLimit" BOOLEAN NOT NULL DEFAULT true,
  "mortalityDailyLimitPct" DECIMAL(6,3) NOT NULL DEFAULT 0.1,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OperationSettings_pkey" PRIMARY KEY ("id")
);
