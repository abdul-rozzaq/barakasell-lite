import { SetMetadata } from '@nestjs/common';

export const REQUIRES_TOTP_KEY = 'requiresTotp';
export const RequiresTotp = () => SetMetadata(REQUIRES_TOTP_KEY, true);
