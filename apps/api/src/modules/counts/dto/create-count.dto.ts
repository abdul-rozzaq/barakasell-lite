import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreateInventoryCountDto {
  @IsOptional()
  @IsString()
  note?: string;

  // Omit to count every active product; pass a subset for a spot-count.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productIds?: string[];
}
