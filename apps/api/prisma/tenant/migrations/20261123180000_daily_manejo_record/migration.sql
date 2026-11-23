ALTER TABLE "Company" ADD COLUMN "veterinarianName" TEXT;
ALTER TABLE "Company" ADD COLUMN "veterinarianCrmv" TEXT;

CREATE TABLE "DailyManejoRecord" (
    "id" TEXT NOT NULL,
    "flockLotId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "waterLiters" DECIMAL(12,3),
    "clinicalSigns" TEXT,
    "treatmentDescription" TEXT,
    "technicalGuidance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyManejoRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyManejoRecord_flockLotId_date_key" ON "DailyManejoRecord"("flockLotId", "date");

ALTER TABLE "DailyManejoRecord" ADD CONSTRAINT "DailyManejoRecord_flockLotId_fkey" FOREIGN KEY ("flockLotId") REFERENCES "FlockLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
