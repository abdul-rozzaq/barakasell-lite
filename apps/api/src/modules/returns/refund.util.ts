import { Prisma } from '../../generated/prisma/client.js';

export interface RefundInput {
  lineTotal: Prisma.Decimal;
  originalQtyBase: Prisma.Decimal;
  returnQtyBase: Prisma.Decimal;
  saleDiscountPct: Prisma.Decimal;
}

// Prorates a line's already-discounted lineTotal by the fraction of qty
// being returned, then applies the SALE-level overall discount on top
// (discountAmount is always subtotal * discountPct/100, so that ratio
// collapses to (1 - discountPct/100) — no need to touch sale.subtotal).
// Deliberately ignores sale.roundingAdj: that's a one-time cents nudge for
// the whole receipt, not something that should compound across partial
// returns. See plan.md "Qaytarish".
export function computeRefund(input: RefundInput): Prisma.Decimal {
  const { lineTotal, originalQtyBase, returnQtyBase, saleDiscountPct } = input;
  const ratio = originalQtyBase.isZero()
    ? new Prisma.Decimal(0)
    : returnQtyBase.div(originalQtyBase);
  const discountFactor = new Prisma.Decimal(1).minus(saleDiscountPct.div(100));
  return lineTotal
    .times(ratio)
    .times(discountFactor)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
