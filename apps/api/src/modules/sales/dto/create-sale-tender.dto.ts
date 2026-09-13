import { IsEnum, IsNumber, Min } from 'class-validator';
import { TenderType } from '../../../generated/prisma/client.js';

export class CreateSaleTenderDto {
  @IsEnum(TenderType)
  type!: TenderType;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}
