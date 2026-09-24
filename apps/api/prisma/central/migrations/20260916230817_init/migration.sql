-- CreateEnum
CREATE TYPE "LicenseStatus" AS ENUM ('trial', 'active', 'suspended', 'expired');

-- CreateEnum
CREATE TYPE "TenantProvisioningStatus" AS ENUM ('PENDING', 'PROVISIONING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "TenantFeatureCode" AS ENUM ('PUBLIC_BIDDING', 'IOT_ENVIRONMENT', 'FLEET');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "licenseStatus" "LicenseStatus" NOT NULL DEFAULT 'trial',
    "licenseExpiresAt" TIMESTAMP(3),
    "databaseName" TEXT NOT NULL,
    "provisioningStatus" "TenantProvisioningStatus" NOT NULL DEFAULT 'PENDING',
    "provisioningError" TEXT,
    "provisioningUpdatedAt" TIMESTAMP(3),
    "provisionAdminEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantFeature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" "TenantFeatureCode" NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_cnpj_key" ON "Tenant"("cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_databaseName_key" ON "Tenant"("databaseName");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeature_tenantId_code_key" ON "TenantFeature"("tenantId", "code");

-- AddForeignKey
ALTER TABLE "TenantFeature" ADD CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
