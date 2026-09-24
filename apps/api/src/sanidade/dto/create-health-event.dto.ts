import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HealthEventType } from '../../generated/tenant-client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateHealthEventDto {
  @ApiProperty()
  @IsUUID()
  flockLotId!: string;

  @ApiProperty({ enum: HealthEventType })
  @IsEnum(HealthEventType)
  type!: HealthEventType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  productName?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  sanitaryProductId?: string;

  @ApiProperty()
  @IsDateString()
  appliedAt!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  withdrawalDays!: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
