import {
  Injectable,
  CanActivate,
  type ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRES_TOTP_KEY } from './requires-totp.decorator.js';
import { TotpService } from './totp.service.js';

@Injectable()
export class TotpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly totpService: TotpService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiresTotp = this.reflector.getAllAndOverride<boolean>(
      REQUIRES_TOTP_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiresTotp) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | undefined> }>();
    const code = request.headers['x-totp-code'];
    if (!code)
      throw new ForbiddenException(
        'TOTP kodi talab qilinadi (X-Totp-Code header)',
      );

    if (!this.totpService.verify(code))
      throw new ForbiddenException("TOTP kodi noto'g'ri yoki muddati o'tgan");

    return true;
  }
}
