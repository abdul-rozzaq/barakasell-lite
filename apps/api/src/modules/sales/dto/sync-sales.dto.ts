import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncSaleItemDto } from './sync-sale-item.dto.js';

export class SyncSalesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SyncSaleItemDto)
  sales!: SyncSaleItemDto[];
}
