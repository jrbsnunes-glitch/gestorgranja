-- AlterTable Company
ALTER TABLE "Company" ADD COLUMN "taxRegime" INTEGER;
ALTER TABLE "Company" ADD COLUMN "cnae" TEXT;
ALTER TABLE "Company" ADD COLUMN "municipalIbgeCode" TEXT;
ALTER TABLE "Company" ADD COLUMN "street" TEXT;
ALTER TABLE "Company" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "Company" ADD COLUMN "district" TEXT;

-- AlterTable Product
ALTER TABLE "Product" ADD COLUMN "cfopInternal" TEXT;
ALTER TABLE "Product" ADD COLUMN "cfopExternal" TEXT;
ALTER TABLE "Product" ADD COLUMN "cest" TEXT;
ALTER TABLE "Product" ADD COLUMN "gtin" TEXT;

-- AlterTable FiscalIssuerSettings
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN "certificatePasswordEnc" TEXT;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN "certificateExpiresAt" TIMESTAMP(3);
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN "nfceSeries" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN "lastNfceNumber" INTEGER NOT NULL DEFAULT 0;

-- AlterTable FiscalDocument
ALTER TABLE "FiscalDocument" ADD COLUMN "model" TEXT;
ALTER TABLE "FiscalDocument" ADD COLUMN "series" INTEGER;
ALTER TABLE "FiscalDocument" ADD COLUMN "number" INTEGER;
ALTER TABLE "FiscalDocument" ADD COLUMN "danfeStorageKey" TEXT;
ALTER TABLE "FiscalDocument" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "FiscalDocument" ADD COLUMN "cancelProtocol" TEXT;

-- CreateTable FiscalCorrectionLetter
CREATE TABLE "FiscalCorrectionLetter" (
    "id" TEXT NOT NULL,
    "fiscalDocumentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "correctionText" TEXT NOT NULL,
    "protocol" TEXT,
    "xmlStorageKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalCorrectionLetter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FiscalCorrectionLetter_fiscalDocumentId_sequence_key" ON "FiscalCorrectionLetter"("fiscalDocumentId", "sequence");

ALTER TABLE "FiscalCorrectionLetter" ADD CONSTRAINT "FiscalCorrectionLetter_fiscalDocumentId_fkey" FOREIGN KEY ("fiscalDocumentId") REFERENCES "FiscalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;
