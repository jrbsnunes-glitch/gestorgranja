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
}
