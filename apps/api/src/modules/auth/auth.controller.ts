import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { PinLoginDto } from './dto/pin-login.dto.js';
import { ConfirmPinDto } from './dto/confirm-pin.dto.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.loginAdmin(dto.login, dto.password);
  }

  @Public()
  @Get('cashiers')
  cashiers() {
    return this.authService.listCashiers();
  }

  @Public()
  @Post('pin-login')
  pinLogin(@Body() dto: PinLoginDto) {
    return this.authService.loginPin(dto.userId, dto.pin);
  }

  @Post('confirm-pin')
  confirmPin(@CurrentUser() user: AuthUser, @Body() dto: ConfirmPinDto) {
    return this.authService.confirmPin(user.sub, dto.pin);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.authService.me(user.sub);
  }
}
