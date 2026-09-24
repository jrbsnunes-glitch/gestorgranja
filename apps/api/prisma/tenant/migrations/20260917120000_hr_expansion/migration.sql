-- CreateEnum
CREATE TYPE "PayrollLineItemKind" AS ENUM ('EARNING', 'DEDUCTION');
CREATE TYPE "EmployeeWithdrawalStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED');
CREATE TYPE "ChartAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- WorkShift
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL DEFAULT 60,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkShift_code_key" ON "WorkShift"("code");

-- ChartAccount
CREATE TABLE "ChartAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ChartAccountType" NOT NULL,
    "parentId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPosting" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ChartAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChartAccount_code_key" ON "ChartAccount"("code");
ALTER TABLE "ChartAccount" ADD CONSTRAINT "ChartAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Employee.workShiftId + unique userId
ALTER TABLE "Employee" ADD COLUMN "workShiftId" TEXT;
CREATE UNIQUE INDEX "Employee_userId_key" ON "Employee"("userId");
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "WorkShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PayrollLineItem
CREATE TABLE "PayrollLineItem" (
    "id" TEXT NOT NULL,
    "payrollLineId" TEXT NOT NULL,
    "kind" "PayrollLineItemKind" NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "sourceRef" TEXT,
    CONSTRAINT "PayrollLineItem_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PayrollLineItem" ADD CONSTRAINT "PayrollLineItem_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmployeeProductWithdrawal
CREATE TABLE "EmployeeProductWithdrawal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "totalAmount" DECIMAL(14,2) NOT NULL,
    "withdrawnAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "status" "EmployeeWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "payrollLineId" TEXT,
    CONSTRAINT "EmployeeProductWithdrawal_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "EmployeeProductWithdrawal" ADD CONSTRAINT "EmployeeProductWithdrawal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeProductWithdrawal" ADD CONSTRAINT "EmployeeProductWithdrawal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeProductWithdrawal" ADD CONSTRAINT "EmployeeProductWithdrawal_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
