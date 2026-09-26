import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpsertFeedDto {
  @ApiProperty()
  @IsUUID()
  flockLotId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  consumedKg!: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  leftoverKg?: number;

  @ApiPropertyOptional({ description: 'Produto de estoque (ração) — habilita baixa automática.' })
  @IsUUID()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  stockLocationId?: string;

  @ApiPropertyOptional({ description: 'Turno, quando aplicável.' })
  @IsString()
  @IsOptional()
  shift?: string;

  @ApiPropertyOptional({ description: 'Justificativa da alteração (gravada na auditoria).' })
  @IsString()
  @IsOptional()
  reason?: string;
}
