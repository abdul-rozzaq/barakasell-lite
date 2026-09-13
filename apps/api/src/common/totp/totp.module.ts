import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TotpService } from './totp.service.js';
import { TotpGuard } from './totp.guard.js';

@Global()
@Module({
  providers: [
    TotpService,
    { provide: APP_GUARD, useClass: TotpGuard },
  ],
  exports: [TotpService],
})
export class TotpModule {}
