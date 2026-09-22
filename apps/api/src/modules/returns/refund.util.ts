import { Prisma } from '../../generated/prisma/client.js';

export interface RefundInput {
  lineTotal: Prisma.Decimal;
  originalQtyBase: Prisma.Decimal;
  returnQtyBase: Prisma.Decimal;
  saleSubtotal: Prisma.Decimal;
  saleDiscountAmount: Prisma.Decimal;
  // Money value of points redeemed at checkout (Sale.loyaltyDiscount).
  // Treated exactly like saleDiscountAmount for refund purposes — the
  // customer never paid this part in cash, so it can't be refunded in
  // cash either. Defaults to 0 for callers/tests predating loyalty.
  saleLoyaltyDiscount?: Prisma.Decimal;
}

// Prorates a line's already-discounted lineTotal by the fraction of qty
// being returned, then applies the SALE-level overall discount (a flat sum)
// on top, expressed as the ratio discountAmount/subtotal so it scales with
// however much of the sale is being returned.
// Deliberately ignores sale.roundingAdj: that's a one-time cents nudge for
// the whole receipt, not something that should compound across partial
// returns. See plan.md "Qaytarish".
export function computeRefund(input: RefundInput): Prisma.Decimal {
  const { lineTotal, originalQtyBase, returnQtyBase, saleSubtotal, saleDiscountAmount } = input;
  const saleLoyaltyDiscount = input.saleLoyaltyDiscount ?? new Prisma.Decimal(0);
  const ratio = originalQtyBase.isZero()
    ? new Prisma.Decimal(0)
    : returnQtyBase.div(originalQtyBase);
  const totalDiscount = saleDiscountAmount.plus(saleLoyaltyDiscount);
  const discountFactor = saleSubtotal.isZero()
    ? new Prisma.Decimal(1)
    : new Prisma.Decimal(1).minus(totalDiscount.div(saleSubtotal));
  return lineTotal
    .times(ratio)
    .times(discountFactor)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
