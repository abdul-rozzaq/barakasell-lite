import { IsNumber, IsString, Min } from 'class-validator';

export class ReceiptLineDto {
  @IsString()
  productId!: string;

  @IsString()
  unitLabel!: string;

  @IsNumber()
  @Min(0.000001)
  qtyInUnit!: number;

  @IsNumber()
  @Min(0)
  unitCostPack!: number;
}
