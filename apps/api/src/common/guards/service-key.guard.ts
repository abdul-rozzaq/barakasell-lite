import { timingSafeEqual } from 'node:crypto';
import { Injectable, CanActivate, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Guards service-to-service endpoints (the Telegram bot calling the API)
// with a shared secret instead of a user JWT. Applied at the controller
// level alongside @Public() — see modules/bot/bot.controller.ts.
@Injectable()
export class ServiceKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided: string | undefined = request.headers['x-service-key'];
    const expected = this.config.getOrThrow<string>('SERVICE_API_KEY');

    if (!provided || !timingSafeEqualStrings(provided, expected)) {
      throw new UnauthorizedException('Yaroqsiz servis kaliti');
    }
    return true;
  }
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
