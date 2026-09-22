import { IsIn, IsOptional, IsString } from 'class-validator';

export class AckOutboxDto {
  @IsIn(['sent', 'failed'])
  status!: 'sent' | 'failed';

  @IsOptional()
  @IsString()
  error?: string;
}
