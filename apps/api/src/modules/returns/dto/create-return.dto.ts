import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TenderType } from '../../../generated/prisma/client.js';
import { CreateReturnLineDto } from './create-return-line.dto.js';

export class CreateReturnDto {
  @IsString()
  saleId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnLineDto)
  lines!: CreateReturnLineDto[];

  @IsEnum(TenderType)
  refundTender!: TenderType;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
