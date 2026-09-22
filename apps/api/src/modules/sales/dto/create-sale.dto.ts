import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsOptional,
  IsString,
  Min,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateSaleLineDto } from './create-sale-line.dto.js';
import { CreateSaleTenderDto } from './create-sale-tender.dto.js';

export class CreateSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleLineDto)
  lines!: CreateSaleLineDto[];

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleTenderDto)
  tenders!: CreateSaleTenderDto[];

  @IsOptional()
  @IsString()
  customerId?: string;

  // Overall discount for the whole sale, as a flat sum (so'm), entered by
  // the cashier at checkout — not a percentage. Validated against subtotal
  // in SalesService, since the max depends on the resolved line totals.
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountAmount?: number;

  @IsOptional()
  @IsDateString()
  soldAt?: string;
}
