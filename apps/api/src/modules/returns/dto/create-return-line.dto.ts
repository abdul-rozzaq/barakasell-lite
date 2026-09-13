import { IsNumber, IsString, Min } from 'class-validator';

export class CreateReturnLineDto {
  @IsString()
  saleLineId!: string;

  @IsNumber()
  @Min(0.000001)
  qtyBase!: number;
}
