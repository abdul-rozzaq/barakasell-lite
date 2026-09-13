import { Injectable, CanActivate, type ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { REQUIRES_PIN_KEY } from '../../../common/decorators/requires-pin.decorator.js';

@Injectable()
export class PinConfirmationGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiresPin = this.reflector.getAllAndOverride<boolean>(REQUIRES_PIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiresPin) return true;

    const request = context.switchToHttp().getRequest();
    const confirmationToken: string | undefined = request.headers['x-pin-confirmation'];
    if (!confirmationToken) {
      throw new ForbiddenException('PIN tasdiqlash talab qilinadi');
    }

    try {
      const payload = await this.jwt.verifyAsync(confirmationToken);
      if (payload.purpose !== 'pin-confirm' || payload.sub !== request.user?.sub) {
        throw new Error('mismatch');
      }
      request.pinConfirmed = true;
      return true;
    } catch {
      throw new ForbiddenException('PIN tasdiqlash yaroqsiz yoki eskirgan');
    }
  }
}
