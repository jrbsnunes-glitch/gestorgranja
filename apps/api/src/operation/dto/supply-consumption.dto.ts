import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { SupplyMovementKind } from '../../generated/tenant-client';

export class UpsertSupplyConsumptionDto {
  @ApiProperty({ example: '2026-09-25' })
  @IsDateString()
  date!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  barnId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  flockLotId?: string;

  @ApiProperty()
  @IsUUID()
  productId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockLocationId?: string;

  @ApiPropertyOptional({ enum: SupplyMovementKind })
  @IsEnum(SupplyMovementKind)
  @IsOptional()
  kind?: SupplyMovementKind;

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
  notes?: string;

  @ApiPropertyOptional({ description: 'Justificativa da alteração (auditoria).' })
  @IsString()
  @IsOptional()
  reason?: string;
}
