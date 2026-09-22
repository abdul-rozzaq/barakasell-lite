import { Prisma } from '../../generated/prisma/client.js';

export interface LoyaltyEarnSettings {
  loyaltyEarnPoints: number;
  loyaltyEarnPerSum: Prisma.Decimal;
}

export interface LoyaltyRedeemSettings {
  loyaltyPointValue: Prisma.Decimal;
  loyaltyMinRedeemPoints: number;
  loyaltyMaxRedeemPercent: number;
}

// Points earn on the amount actually charged (Sale.total, after discount),
// not the subtotal — a discounted sale earns fewer points. Floor division:
// a partial loyaltyEarnPerSum chunk does not round up to a free point.
export function computeEarnedPoints(
  netAmount: Prisma.Decimal,
  settings: LoyaltyEarnSettings,
): number {
  if (settings.loyaltyEarnPerSum.lte(0) || netAmount.lte(0)) return 0;
  const chunks = netAmount.div(settings.loyaltyEarnPerSum).floor();
  return chunks.times(settings.loyaltyEarnPoints).toNumber();
}

export function computeRedeemValue(
  points: number,
  settings: Pick<LoyaltyRedeemSettings, 'loyaltyPointValue'>,
): Prisma.Decimal {
  return settings.loyaltyPointValue.times(points);
}

// The most points a customer may redeem on a given sale: capped by their
// balance, capped by loyaltyMaxRedeemPercent of the subtotal (a sale can
// never be paid entirely in points), and floored to 0 below
// loyaltyMinRedeemPoints (a token discount isn't worth the checkout UI
// friction of a partial redemption).
export function maxRedeemablePoints(
  subtotal: Prisma.Decimal,
  balance: number,
  settings: LoyaltyRedeemSettings,
): number {
  if (settings.loyaltyPointValue.lte(0)) return 0;
  const capValue = subtotal.times(settings.loyaltyMaxRedeemPercent).div(100);
  const capPoints = capValue.div(settings.loyaltyPointValue).floor().toNumber();
  const usable = Math.min(balance, capPoints);
  return usable >= settings.loyaltyMinRedeemPoints ? usable : 0;
}

// How many of a sale's earned points to claw back on a (partial) return,
// proportional to how much money is being refunded. Since a sale's returns
// can never refund more in total than sale.total (see refund.util.ts), the
// sum of this across all of a sale's returns never exceeds pointsEarned —
// no separate "points already reversed" counter is needed.
export function proportionalPointsReversal(
  pointsEarned: number,
  refundAmount: Prisma.Decimal,
  saleTotal: Prisma.Decimal,
): number {
  if (pointsEarned <= 0 || saleTotal.lte(0)) return 0;
  return refundAmount.div(saleTotal).times(pointsEarned).floor().toNumber();
}
