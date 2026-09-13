import { describe, it, expect } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { computeRefund } from './refund.util.js';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('computeRefund', () => {
  it('full-quantity return of a line with no sale-level discount refunds the full lineTotal', () => {
    const r = computeRefund({
      lineTotal: D(50000),
      originalQtyBase: D(10),
      returnQtyBase: D(10),
      saleDiscountPct: D(0),
    });
    expect(r.toString()).toBe('50000');
  });

  it('partial-quantity return prorates by qty', () => {
    const r = computeRefund({
      lineTotal: D(50000),
      originalQtyBase: D(10),
      returnQtyBase: D(4),
      saleDiscountPct: D(0),
    });
    expect(r.toString()).toBe('20000');
  });

  it('a sale-level discount is applied on top of the qty proration', () => {
    const r = computeRefund({
      lineTotal: D(100000),
      originalQtyBase: D(10),
      returnQtyBase: D(10),
      saleDiscountPct: D(10),
    });
    expect(r.toString()).toBe('90000');
  });

  it('total refund across all returned lines never exceeds the sale total when discount applies', () => {
    // Two lines summing to a 200000 subtotal, sale.total=180000 (10% discount).
    const line1 = computeRefund({
      lineTotal: D(100000),
      originalQtyBase: D(5),
      returnQtyBase: D(5),
      saleDiscountPct: D(10),
    });
    const line2 = computeRefund({
      lineTotal: D(100000),
      originalQtyBase: D(5),
      returnQtyBase: D(5),
      saleDiscountPct: D(10),
    });
    expect(line1.plus(line2).toString()).toBe('180000');
  });

  it('rounds to 2 decimal places (money)', () => {
    const r = computeRefund({
      lineTotal: D(10000),
      originalQtyBase: D(3),
      returnQtyBase: D(1),
      saleDiscountPct: D(0),
    });
    expect(r.toString()).toBe('3333.33');
  });
});
