import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ConsumptionSyncMode, OccurrencePriority } from '../../generated/tenant-client';

export class ReviewItemDto {
  @ApiProperty({ example: 'DailyEggProduction' })
  @IsString()
  entity!: string;

  @ApiProperty()
  @IsUUID()
  id!: string;
}

export class ReviewManyDto {
  @ApiProperty({ type: [ReviewItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  items!: ReviewItemDto[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class ReviewOneDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class ReviewDayDto {
  @ApiProperty({ example: '2026-09-25' })
  @IsString()
  date!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  barnId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  note?: string;
}

export class UpdateOperationSettingsDto {
  @ApiPropertyOptional({ enum: ConsumptionSyncMode })
  @IsEnum(ConsumptionSyncMode)
  @IsOptional()
  consumptionSyncMode?: ConsumptionSyncMode;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  eggSyncOnlyReviewed?: boolean;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  stockChartAccountId?: string | null;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableProductionBelowStandard?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  productionBelowStandardPct?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableFeedVariation?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  feedVariationPct?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enablePendingRecords?: boolean;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  @IsOptional()
  pendingRecordsAfterHour?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableOpenOccurrence?: boolean;

  @ApiPropertyOptional({ enum: OccurrencePriority })
  @IsEnum(OccurrencePriority)
  @IsOptional()
  openOccurrenceMinPriority?: OccurrencePriority;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  openOccurrenceMaxHours?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableLossAboveLimit?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  lossAboveLimitPct?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  enableMortalityAboveLimit?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  mortalityDailyLimitPct?: number;
}
