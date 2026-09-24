-- CreateEnum
CREATE TYPE "PartnerPersonType" AS ENUM ('PF', 'PJ');

-- AlterTable
ALTER TABLE "Partner" ADD COLUMN     "personType" "PartnerPersonType" NOT NULL DEFAULT 'PJ',
ADD COLUMN     "tradeName" TEXT,
ADD COLUMN     "cpf" TEXT,
ADD COLUMN     "cnpj" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "mobile" TEXT,
ADD COLUMN     "stateRegistration" TEXT,
ADD COLUMN     "zipCode" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "addressNumber" TEXT,
ADD COLUMN     "addressComplement" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" TEXT;
