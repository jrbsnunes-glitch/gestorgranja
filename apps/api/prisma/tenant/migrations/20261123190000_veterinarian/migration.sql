CREATE TABLE "Veterinarian" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "crmv" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isResponsible" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Veterinarian_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Veterinarian_controlNumber_key" ON "Veterinarian"("controlNumber");
