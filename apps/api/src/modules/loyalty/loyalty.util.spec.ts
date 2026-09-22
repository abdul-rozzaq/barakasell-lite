import { describe, it, expect } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import {
  computeEarnedPoints,
  computeRedeemValue,
  maxRedeemablePoints,
  proportionalPointsReversal,
} from './loyalty.util.js';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('computeEarnedPoints', () => {
  const settings = { loyaltyEarnPoints: 1, loyaltyEarnPerSum: D(1000) };

  it('earns 1 point per 1000 so\'m, floored', () => {
    expect(computeEarnedPoints(D(3500), settings)).toBe(3);
  });

  it('earns 0 below the first chunk', () => {
    expect(computeEarnedPoints(D(999), settings)).toBe(0);
  });

  it('scales with loyaltyEarnPoints', () => {
    expect(computeEarnedPoints(D(2000), { loyaltyEarnPoints: 5, loyaltyEarnPerSum: D(1000) })).toBe(10);
  });

  it('returns 0 for a non-positive amount', () => {
    expect(computeEarnedPoints(D(0), settings)).toBe(0);
  });
});

describe('computeRedeemValue', () => {
  it('multiplies points by the configured point value', () => {
    expect(computeRedeemValue(10, { loyaltyPointValue: D(100) }).toString()).toBe('1000');
  });
});

describe('maxRedeemablePoints', () => {
  const settings = {
    loyaltyPointValue: D(100),
    loyaltyMinRedeemPoints: 10,
    loyaltyMaxRedeemPercent: 50,
  };

  it('caps at the customer balance when below the percent cap', () => {
    expect(maxRedeemablePoints(D(100000), 20, settings)).toBe(20);
  });

  it('caps at loyaltyMaxRedeemPercent of the subtotal', () => {
    // 50% of 10000 = 5000 so'm = 50 points, balance has more than that.
    expect(maxRedeemablePoints(D(10000), 200, settings)).toBe(50);
  });

  it('floors to 0 below loyaltyMinRedeemPoints', () => {
    expect(maxRedeemablePoints(D(100000), 5, settings)).toBe(0);
  });
});

describe('proportionalPointsReversal', () => {
  it('reverses all points on a full-amount refund', () => {
    expect(proportionalPointsReversal(30, D(50000), D(50000))).toBe(30);
  });

  it('reverses proportionally on a partial refund', () => {
    expect(proportionalPointsReversal(30, D(25000), D(50000))).toBe(15);
  });

  it('returns 0 when nothing was earned', () => {
    expect(proportionalPointsReversal(0, D(25000), D(50000))).toBe(0);
  });
});
