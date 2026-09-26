import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { FlockMovementType } from '../../generated/tenant-client';

export class CreateFlockMovementDto {
  @ApiProperty({ example: '2026-09-25' })
  @IsDateString()
  date!: string;

  @ApiProperty({ enum: FlockMovementType })
  @IsEnum(FlockMovementType)
  type!: FlockMovementType;

  @ApiProperty({ description: 'Quantidade de aves. Em ADJUST pode ser negativa; em CLOSE é ignorada.' })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Lote de contrapartida em transferências.' })
  @IsUUID()
  @IsOptional()
  counterpartLotId?: string;

  @ApiPropertyOptional({ description: 'Motivo / justificativa (obrigatório em ADJUST e CLOSE).' })
  @IsString()
  @IsOptional()
  reason?: string;
}
