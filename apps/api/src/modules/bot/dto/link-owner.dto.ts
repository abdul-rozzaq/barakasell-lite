import { IsNumberString, IsString, Length } from 'class-validator';

export class LinkOwnerDto {
  @IsString()
  @Length(6, 6)
  code!: string;

  @IsNumberString()
  telegramId!: string;
}
