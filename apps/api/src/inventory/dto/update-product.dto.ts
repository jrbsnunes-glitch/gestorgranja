import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  groupId?: string | null;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStockQty?: number;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fiscalSituationId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  ncm?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fiscalOrigin?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fiscalCst?: string | null;
}
