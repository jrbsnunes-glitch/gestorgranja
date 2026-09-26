import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpsertDailyEggDto {
  @ApiProperty()
  @IsUUID()
  flockLotId!: string;

  @ApiProperty({ example: '2025-09-16' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  extra = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  large = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  medium = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  small = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  cracked = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  dirty = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deformed = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discard = 0;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  avgEggWeightG?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ description: 'Motivo do descarte, quando registrado.' })
  @IsString()
  @IsOptional()
  discardReason?: string;

  @ApiPropertyOptional({ description: 'Turno (manhã, tarde, noite…), quando aplicável.' })
  @IsString()
  @IsOptional()
  shift?: string;

  @ApiPropertyOptional({ description: 'Justificativa da alteração (gravada na auditoria).' })
  @IsString()
  @IsOptional()
  reason?: string;
}
