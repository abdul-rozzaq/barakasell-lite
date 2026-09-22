import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
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

  // Points to redeem for a checkout discount. Capped server-side by
  // maxRedeemablePoints() (customer's balance, loyaltyMaxRedeemPercent of
  // the discounted subtotal, loyaltyMinRedeemPoints floor) — see
  // SalesService.create().
  @IsOptional()
  @IsInt()
  @Min(0)
  redeemPoints?: number;

  @IsOptional()
  @IsDateString()
  soldAt?: string;
}
