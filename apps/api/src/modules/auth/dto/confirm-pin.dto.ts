import { IsString, MinLength } from 'class-validator';

// Named "pin" for the common cashier case, but an admin confirms with their
// password here — both flow through AuthService.confirmPin, so length isn't
// fixed at 4 digits.
export class ConfirmPinDto {
  @IsString()
  @MinLength(1)
  pin!: string;
}
