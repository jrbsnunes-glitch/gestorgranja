-- CreateEnum
CREATE TYPE "CommercialPlan" AS ENUM ('trial', 'package_a', 'package_b', 'package_c', 'pilot');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "commercialPlan" "CommercialPlan" NOT NULL DEFAULT 'trial',
ADD COLUMN     "maxBirds" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN     "maxBarns" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "maxUsers" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "contractStartedAt" TIMESTAMP(3),
ADD COLUMN     "billingDay" INTEGER NOT NULL DEFAULT 10;
