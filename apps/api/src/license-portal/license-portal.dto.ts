import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import type { CommercialPlanCode } from '../commercial/plans';

const PLAN_CODES: CommercialPlanCode[] = ['basic', 'complete'];

export class PortalLoginDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(1)
  password!: string;
}

export class ProvisionPortalTenantDto {
  @IsString()
  slug!: string;

  @IsString()
  cnpj!: string;

  @IsString()
  companyName!: string;

  @IsString()
  databaseName!: string;

  @IsEmail()
  adminEmail!: string;

  @IsString()
  @MinLength(6)
  adminPassword!: string;

  @IsOptional()
  @IsString()
  adminName?: string;

  @IsIn(PLAN_CODES)
  commercialPlan!: CommercialPlanCode;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractEntryFeeBrl!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractMonthlyFeeBrl!: number;
}

export class RevalidateLicenseDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  months?: number;
}

export class ActivateLicenseDto {
  @IsIn(PLAN_CODES)
  plan!: CommercialPlanCode;

  @IsOptional()
  @IsString()
  entryPaidAt?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  billingDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractEntryFeeBrl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractMonthlyFeeBrl?: number;
}

export class AdminPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword!: string;
}

const LICENSE_STATUSES = ['trial', 'active', 'suspended', 'expired'] as const;

export class EditPortalTenantDto {
  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @IsOptional()
  @IsIn(PLAN_CODES)
  commercialPlan?: CommercialPlanCode;

  @IsOptional()
  @IsIn(LICENSE_STATUSES)
  licenseStatus?: (typeof LICENSE_STATUSES)[number];

  @IsOptional()
  @IsString()
  licenseExpiresAt?: string;

  @IsOptional()
  @IsEmail()
  provisionAdminEmail?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  billingDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractEntryFeeBrl?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  contractMonthlyFeeBrl?: number;
}
