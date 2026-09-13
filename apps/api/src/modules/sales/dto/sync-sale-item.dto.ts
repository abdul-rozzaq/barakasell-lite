import { IsString } from 'class-validator';
import { CreateSaleDto } from './create-sale.dto.js';

export class SyncSaleItemDto extends CreateSaleDto {
  @IsString()
  idempotencyKey!: string;
}
