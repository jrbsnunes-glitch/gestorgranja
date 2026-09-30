ALTER TABLE "FiscalIssuerSettings" ADD COLUMN IF NOT EXISTS "respTecCnpj" TEXT;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN IF NOT EXISTS "respTecContact" TEXT;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN IF NOT EXISTS "respTecEmail" TEXT;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN IF NOT EXISTS "respTecPhone" TEXT;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN IF NOT EXISTS "respTecCsrtId" TEXT;
ALTER TABLE "FiscalIssuerSettings" ADD COLUMN IF NOT EXISTS "respTecCsrtEnc" TEXT;
