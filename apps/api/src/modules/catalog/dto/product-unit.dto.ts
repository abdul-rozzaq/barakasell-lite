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
}
