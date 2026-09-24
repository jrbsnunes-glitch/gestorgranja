import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MortalityCause } from '../../generated/tenant-client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpsertDailyMortalityDto {
  @ApiProperty()
  @IsUUID()
  flockLotId!: string;

  @ApiProperty()
  @IsDateString()
  date!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;

  @ApiPropertyOptional({ enum: MortalityCause })
  @IsEnum(MortalityCause)
  @IsOptional()
  cause?: MortalityCause;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  causeNotes?: string;
}
