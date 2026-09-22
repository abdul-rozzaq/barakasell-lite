import { IsNumberString, IsOptional, IsString } from 'class-validator';

// telegramId travels as a numeric string, not a number — Telegram user ids
// can exceed Number.MAX_SAFE_INTEGER, and BigInt(dto.telegramId) needs a
// string/number, not a JS number that may have already lost precision.
export class BotRegisterDto {
  @IsNumberString()
  telegramId!: string;

  @IsString()
  phone!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  telegramUsername?: string;
}
