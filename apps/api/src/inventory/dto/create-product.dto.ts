import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductType } from '../../generated/tenant-client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  sku!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  groupId?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  salePrice?: number;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  type!: ProductType;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  minStockQty?: number;

  @ApiPropertyOptional({ description: 'Situação fiscal (NCM, CST, IBS/CBS) em Cadastros → Situação fiscal' })
  @IsString()
  @IsOptional()
  fiscalSituationId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  fiscalOrigin?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  gtin?: string;
}
