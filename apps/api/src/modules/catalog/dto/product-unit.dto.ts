import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ProductUnitDto {
  @IsString()
  label!: string;

  @IsNumber()
  @Min(0.000001)
  factor!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsBoolean()
  isBase?: boolean;

  // Admin-only standing discount for this unit, as a flat sum (so'm) off
  // the price above, applied automatically to every sale of it. See
  // ProductUnit.discountAmount. The admin UI may let the user type a %
  // instead, but converts it to a sum before sending this field.
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}
