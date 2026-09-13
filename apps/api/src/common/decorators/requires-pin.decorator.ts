import { SetMetadata } from '@nestjs/common';

export const REQUIRES_PIN_KEY = 'requiresPin';
export const RequiresPinConfirmation = () => SetMetadata(REQUIRES_PIN_KEY, true);
