import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import type { CommercialPlanCode } from '../commercial/plans';

const PLAN_CODES: CommercialPlanCode[] = ['trial', 'package_a', 'package_b', 'package_c', 'pilot'];

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

  @IsOptional()
  @IsIn(PLAN_CODES)
  commercialPlan?: CommercialPlanCode;
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
}

export class AdminPasswordDto {
  @IsString()
  @MinLength(6)
  newPassword!: string;
}
