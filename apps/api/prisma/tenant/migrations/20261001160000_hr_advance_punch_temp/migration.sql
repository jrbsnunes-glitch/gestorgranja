-- CreateEnum
CREATE TYPE "EmploymentCategory" AS ENUM ('GENERAL_101', 'TEMPORARY_106');
CREATE TYPE "RemunerationType" AS ENUM ('MONTHLY', 'HOURLY', 'DAILY');
CREATE TYPE "SalaryAdvanceStatus" AS ENUM ('PENDING', 'APPLIED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "TimeClockPunchSource" ADD VALUE 'MANUAL';

-- AlterTable HrSettings
ALTER TABLE "HrSettings" ADD COLUMN "salaryAdvanceMaxPct" DECIMAL(5,2) NOT NULL DEFAULT 40;
ALTER TABLE "HrSettings" ADD COLUMN "requireSalaryAdvanceNotes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable Employee
ALTER TABLE "Employee" ADD COLUMN "employmentCategory" "EmploymentCategory" NOT NULL DEFAULT 'GENERAL_101';
ALTER TABLE "Employee" ADD COLUMN "remunerationType" "RemunerationType" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "Employee" ADD COLUMN "hourlyRate" DECIMAL(14,2);
ALTER TABLE "Employee" ADD COLUMN "dailyRate" DECIMAL(14,2);
ALTER TABLE "Employee" ADD COLUMN "tempContractEndsAt" DATE;

-- AlterTable PayrollLine
ALTER TABLE "PayrollLine" ADD COLUMN "workedDays" DECIMAL(8,2) NOT NULL DEFAULT 0;

-- AlterTable TimeClockPunch
ALTER TABLE "TimeClockPunch" ADD COLUMN "manualReason" TEXT;
ALTER TABLE "TimeClockPunch" ADD COLUMN "createdByUserId" TEXT;

-- CreateTable EmployeeSalaryAdvance
CREATE TABLE "EmployeeSalaryAdvance" (
    "id" TEXT NOT NULL,
    "controlNumber" SERIAL NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" DATE NOT NULL,
    "discountYearMonth" TEXT NOT NULL,
    "status" "SalaryAdvanceStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "payrollLineId" TEXT,
    "approvedByUserId" TEXT,

    CONSTRAINT "EmployeeSalaryAdvance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeSalaryAdvance_controlNumber_key" ON "EmployeeSalaryAdvance"("controlNumber");

ALTER TABLE "EmployeeSalaryAdvance" ADD CONSTRAINT "EmployeeSalaryAdvance_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeSalaryAdvance" ADD CONSTRAINT "EmployeeSalaryAdvance_payrollLineId_fkey" FOREIGN KEY ("payrollLineId") REFERENCES "PayrollLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
