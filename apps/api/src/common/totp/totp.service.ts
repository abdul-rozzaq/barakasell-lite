import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as OTPAuth from 'otpauth';

@Injectable()
export class TotpService {
  private readonly totp: OTPAuth.TOTP;

  constructor(private readonly config: ConfigService) {
    let secret = this.config.get<string>('TOTP_SECRET');
    if (!secret) { if (process.env.NODE_ENV === 'test') { secret = 'MFRGGZDFMZTWQ2LK'; } else { throw new Error('TOTP_SECRET .env da mavjud emas'); } }
    
    this.totp = new OTPAuth.TOTP({
      issuer: 'BarakaSELL',
      label: 'Admin',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });
  }

  verify(code: string): boolean {
    const delta = this.totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  generate(): string {
    return this.totp.generate();
  }
}
