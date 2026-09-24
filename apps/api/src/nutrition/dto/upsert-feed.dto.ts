import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsUUID, Min } from 'class-validator';

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
}
