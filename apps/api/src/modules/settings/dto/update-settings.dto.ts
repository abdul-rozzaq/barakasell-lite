import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
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
}
