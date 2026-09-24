-- Permite vários lançamentos de mortalidade no mesmo lote e data
DROP INDEX IF EXISTS "DailyMortality_flockLotId_date_key";

CREATE INDEX IF NOT EXISTS "DailyMortality_flockLotId_date_idx" ON "DailyMortality"("flockLotId", "date");
