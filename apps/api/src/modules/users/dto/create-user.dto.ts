import { IsEnum, IsString, Length, MinLength, ValidateIf } from 'class-validator';
import { UserRole } from '../../../generated/prisma/client.js';

export class CreateUserDto {
  @IsString()
  name!: string;

  @IsEnum(UserRole)
  role!: UserRole;

  @ValidateIf((o: CreateUserDto) => o.role === UserRole.ADMIN)
  @IsString()
  login?: string;

  @ValidateIf((o: CreateUserDto) => o.role === UserRole.ADMIN)
  @IsString()
  @MinLength(6)
  password?: string;

  @ValidateIf((o: CreateUserDto) => o.role === UserRole.CASHIER)
  @IsString()
  @Length(4, 4)
  pin?: string;
}
