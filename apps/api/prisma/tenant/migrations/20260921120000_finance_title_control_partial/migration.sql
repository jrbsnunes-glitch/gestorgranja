-- AlterTable AccountPayable
ALTER TABLE "AccountPayable" ADD COLUMN "controlNumber" INTEGER;
ALTER TABLE "AccountPayable" ADD COLUMN "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "dueDate", id) AS rn FROM "AccountPayable"
)
UPDATE "AccountPayable" ap SET "controlNumber" = numbered.rn FROM numbered WHERE ap.id = numbered.id;

ALTER TABLE "AccountPayable" ALTER COLUMN "controlNumber" SET NOT NULL;
CREATE UNIQUE INDEX "AccountPayable_controlNumber_key" ON "AccountPayable"("controlNumber");

-- AlterTable AccountReceivable
ALTER TABLE "AccountReceivable" ADD COLUMN "controlNumber" INTEGER;
ALTER TABLE "AccountReceivable" ADD COLUMN "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "dueDate", id) AS rn FROM "AccountReceivable"
)
UPDATE "AccountReceivable" ar SET "controlNumber" = numbered.rn FROM numbered WHERE ar.id = numbered.id;

ALTER TABLE "AccountReceivable" ALTER COLUMN "controlNumber" SET NOT NULL;
CREATE UNIQUE INDEX "AccountReceivable_controlNumber_key" ON "AccountReceivable"("controlNumber");
