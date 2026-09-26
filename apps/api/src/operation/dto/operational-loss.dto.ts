import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { OperationalLossType } from '../../generated/tenant-client';

export class UpsertOperationalLossDto {
  @ApiProperty({ example: '2026-09-25' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: OperationalLossType })
  @IsEnum(OperationalLossType)
  type!: OperationalLossType;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  barnId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  flockLotId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  quantity!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  actionTaken?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  estimatedCost?: number;
}
