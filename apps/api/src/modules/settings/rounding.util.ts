import { Prisma } from '../../generated/prisma/client.js';
import type { RoundingMode } from '../../generated/prisma/client.js';

export interface RoundingResult {
  rounded: Prisma.Decimal;
  adj: Prisma.Decimal; // rounded - total, signed
}

const STEP: Record<Exclude<RoundingMode, 'NONE'>, number> = {
  R10: 10,
  R100: 100,
  R1000: 1000,
};

// Round-to-nearest-step (banker-free, plain nearest) so a rounded total can
// land either above or below the exact sum — see plan.md "Sozlamalar".
export function applyRounding(
  total: Prisma.Decimal,
  mode: RoundingMode,
): RoundingResult {
  if (mode === 'NONE') {
    return { rounded: total, adj: new Prisma.Decimal(0) };
  }
  const step = new Prisma.Decimal(STEP[mode]);
  const rounded = total
    .div(step)
    .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    .times(step);
  return { rounded, adj: rounded.minus(total) };
}
