import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsObject, IsString, IsUUID, ValidateNested } from 'class-validator';

class SyncOperationDto {
  @ApiProperty()
  @IsUUID()
  operationId!: string;

  @ApiProperty()
  @IsString()
  type!: 'dailyEggProduction' | 'dailyMortality' | 'dailyFeedConsumption';

  @ApiProperty()
  @IsObject()
  payload!: Record<string, unknown>;

  @ApiProperty()
  @IsString()
  clientUpdatedAt!: string;
}

export class SyncBatchDto {
  @ApiProperty({ type: [SyncOperationDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncOperationDto)
  operations!: SyncOperationDto[];
}
