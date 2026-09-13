import { ArrayMinSize, IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductUnitDto } from './product-unit.dto.js';

export class CreateProductDto {
  @IsString()
  sku!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ProductUnitDto)
  units!: ProductUnitDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  barcodes?: string[];
}
