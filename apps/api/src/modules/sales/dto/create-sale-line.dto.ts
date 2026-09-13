import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateSaleLineDto {
  @IsString()
  productId!: string;

  @IsString()
  unitLabel!: string;

  @IsNumber()
  @Min(0.000001)
  qtyInUnit!: number;

  // Server uses ProductUnit.price unless the client overrides it (e.g. a
  // manual price edit) — overrides are still accepted but are worth
  // auditing separately in a later milestone. See plan.md B3/"Audit".
  @IsOptional()
  @IsNumber()
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;
}
