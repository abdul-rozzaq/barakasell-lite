import { IsString, Length } from 'class-validator';

export class UpdatePinDto {
  @IsString()
  @Length(4, 4)
  pin!: string;
}
