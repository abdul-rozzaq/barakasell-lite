import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { TenderType } from '../../../generated/prisma/client.js';

export class CreatePaymentDto {
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsEnum(TenderType)
  tender!: TenderType;

  @IsOptional()
  @IsString()
  note?: string;
}
