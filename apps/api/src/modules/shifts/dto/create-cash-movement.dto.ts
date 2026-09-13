import { IsEnum, IsNumber, IsString, Min } from 'class-validator';
import { CashMoveType } from '../../../generated/prisma/client.js';

export class CreateCashMovementDto {
  @IsEnum(CashMoveType)
  type!: CashMoveType;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  reason!: string;
}
