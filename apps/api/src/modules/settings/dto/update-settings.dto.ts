import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { RoundingMode } from '../../../generated/prisma/client.js';

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  allowNegativeStock?: boolean;

  @IsOptional()
  @IsEnum(RoundingMode)
  roundingMode?: RoundingMode;

  @IsOptional()
  @IsString()
  storeName?: string;

  @IsOptional()
  @IsBoolean()
  loyaltyEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyEarnPoints?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyEarnPerSum?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loyaltyPointValue?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyMinRedeemPoints?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  loyaltyMaxRedeemPercent?: number;
}
