-- CreateEnum
CREATE TYPE "SicoobEnvironment" AS ENUM ('sandbox', 'production');

-- CreateEnum
CREATE TYPE "BankBoletoStatus" AS ENUM ('REGISTERED', 'PAID', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "SicoobCobrancaSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyId" TEXT NOT NULL,
    "environment" "SicoobEnvironment" NOT NULL DEFAULT 'sandbox',
    "clientId" TEXT,
    "numeroCliente" INTEGER,
    "numeroContaCorrente" TEXT,
    "codigoModalidade" INTEGER NOT NULL DEFAULT 1,
    "codigoEspecieDocumento" TEXT NOT NULL DEFAULT 'DM',
    "identificacaoEmissaoBoleto" INTEGER NOT NULL DEFAULT 1,
    "identificacaoDistribuicaoBoleto" INTEGER NOT NULL DEFAULT 1,
    "codigoCadastrarPIX" INTEGER NOT NULL DEFAULT 0,
    "tipoMulta" INTEGER NOT NULL DEFAULT 0,
    "tipoJurosMora" INTEGER NOT NULL DEFAULT 3,
    "codigoProtesto" INTEGER NOT NULL DEFAULT 3,
    "codigoNegativacao" INTEGER NOT NULL DEFAULT 3,
    "dueDaysDefault" INTEGER NOT NULL DEFAULT 7,
    "useFiscalCertificate" BOOLEAN NOT NULL DEFAULT true,
    "certificatePath" TEXT,
    "certificatePasswordEnc" TEXT,
    "sandboxAccessTokenEnc" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SicoobCobrancaSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankBoleto" (
    "id" TEXT NOT NULL,
    "receivableId" TEXT,
    "salesOrderId" TEXT,
    "seuNumero" TEXT NOT NULL,
    "nossoNumero" TEXT,
    "codigoBarras" TEXT,
    "linhaDigitavel" TEXT,
    "qrCode" TEXT,
    "pdfStorageKey" TEXT,
    "status" "BankBoletoStatus" NOT NULL DEFAULT 'REGISTERED',
    "valor" DECIMAL(14,2) NOT NULL,
    "dataVencimento" DATE NOT NULL,
    "situacaoBoleto" TEXT,
    "lastError" TEXT,
    "registeredAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankBoleto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SicoobCobrancaSettings_companyId_key" ON "SicoobCobrancaSettings"("companyId");

-- CreateIndex
CREATE INDEX "BankBoleto_receivableId_idx" ON "BankBoleto"("receivableId");

-- CreateIndex
CREATE INDEX "BankBoleto_salesOrderId_idx" ON "BankBoleto"("salesOrderId");

-- CreateIndex
CREATE INDEX "BankBoleto_status_idx" ON "BankBoleto"("status");

-- CreateIndex
CREATE INDEX "BankBoleto_nossoNumero_idx" ON "BankBoleto"("nossoNumero");

-- CreateIndex
CREATE INDEX "AccountReceivable_salesOrderId_idx" ON "AccountReceivable"("salesOrderId");

-- AddForeignKey
ALTER TABLE "SicoobCobrancaSettings" ADD CONSTRAINT "SicoobCobrancaSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBoleto" ADD CONSTRAINT "BankBoleto_receivableId_fkey" FOREIGN KEY ("receivableId") REFERENCES "AccountReceivable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankBoleto" ADD CONSTRAINT "BankBoleto_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "AccountReceivable" SET "salesOrderId" = NULL
WHERE "salesOrderId" IS NOT NULL
  AND "salesOrderId" NOT IN (SELECT "id" FROM "SalesOrder");

-- AddForeignKey
ALTER TABLE "AccountReceivable" ADD CONSTRAINT "AccountReceivable_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
