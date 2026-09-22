import { IsOptional, IsString } from 'class-validator';

export class CreateBotWaitlistDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsString()
  rawText?: string;
}
