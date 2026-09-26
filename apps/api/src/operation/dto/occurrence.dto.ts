import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { OccurrencePriority, OccurrenceStatus, OccurrenceType } from '../../generated/tenant-client';

export class CreateOccurrenceDto {
  @ApiProperty({ example: '2026-09-25T08:30:00' })
  @IsDateString()
  occurredAt!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  barnId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  flockLotId?: string;

  @ApiProperty({ enum: OccurrenceType })
  @IsEnum(OccurrenceType)
  type!: OccurrenceType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  location?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  description!: string;

  @ApiPropertyOptional({ enum: OccurrencePriority })
  @IsEnum(OccurrencePriority)
  @IsOptional()
  priority?: OccurrencePriority;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  assetId?: string;
}

export class UpdateOccurrenceDto {
  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  occurredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  barnId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  flockLotId?: string | null;

  @ApiPropertyOptional({ enum: OccurrenceType })
  @IsEnum(OccurrenceType)
  @IsOptional()
  type?: OccurrenceType;

  @ApiPropertyOptional()
  @IsOptional()
  location?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ enum: OccurrencePriority })
  @IsEnum(OccurrencePriority)
  @IsOptional()
  priority?: OccurrencePriority;

  @ApiPropertyOptional({ enum: OccurrenceStatus })
  @IsEnum(OccurrenceStatus)
  @IsOptional()
  status?: OccurrenceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  actionTaken?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  assetId?: string | null;
}

export class CreateMaintenanceFromOccurrenceDto {
  @ApiPropertyOptional({ description: 'Equipamento; se omitido usa o da ocorrência.' })
  @IsUUID()
  @IsOptional()
  assetId?: string;

  @ApiPropertyOptional({ example: 'CORRETIVA' })
  @IsString()
  @IsOptional()
  kind?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  performedAt?: string;
}
