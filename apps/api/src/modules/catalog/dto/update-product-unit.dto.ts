import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateProductUnitDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.000001)
  factor?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;
}
