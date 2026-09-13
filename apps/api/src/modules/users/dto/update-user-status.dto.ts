import { IsEnum } from 'class-validator';
import { UserStatus } from '../../../generated/prisma/client.js';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}
