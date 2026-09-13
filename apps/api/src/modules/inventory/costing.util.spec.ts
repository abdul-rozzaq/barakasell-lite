import { describe, it, expect } from 'vitest';
import { computeCosting, D } from './costing.util.js';

describe('computeCosting', () => {
  it('RECEIPT: first-ever receipt (S=0) sets avgCost to the receipt cost', () => {
    const r = computeCosting({
      type: 'RECEIPT',
      stockBefore: D(0),
      avgCostBefore: D(0),
      qtyDelta: D(100),
      unitCost: D(1000),
    });
    expect(r.stockAfter.toString()).toBe('100');
    expect(r.avgCostAfter.toString()).toBe('1000');
    expect(r.costDelta.toString()).toBe('100000');
  });

  it('RECEIPT: exact blend of 100@1000 + 50@1300 -> avg 1100', () => {
    const r = computeCosting({
      type: 'RECEIPT',
      stockBefore: D(100),
      avgCostBefore: D(1000),
      qtyDelta: D(50),
      unitCost: D(1300),
    });
    expect(r.stockAfter.toString()).toBe('150');
    expect(r.avgCostAfter.toString()).toBe('1100');
  });

  it('RECEIPT: negative stock (S<0) resets avgCost instead of blending', () => {
    const r = computeCosting({
      type: 'RECEIPT',
      stockBefore: D(-20),
      avgCostBefore: D(500),
      qtyDelta: D(30),
      unitCost: D(900),
    });
    expect(r.stockAfter.toString()).toBe('10');
    expect(r.avgCostAfter.toString()).toBe('900');
  });

  it('SALE: avgCost unchanged, unitCostUsed is the pre-sale average snapshot', () => {
    const r = computeCosting({
      type: 'SALE',
      stockBefore: D(150),
      avgCostBefore: D(1100),
      qtyDelta: D(-10),
    });
    expect(r.stockAfter.toString()).toBe('140');
    expect(r.avgCostAfter.toString()).toBe('1100');
    expect(r.unitCostUsed.toString()).toBe('1100');
    expect(r.costDelta.toString()).toBe('-11000');
  });

  it('SALE: stock can reach exactly zero', () => {
    const r = computeCosting({
      type: 'SALE',
      stockBefore: D(10),
      avgCostBefore: D(500),
      qtyDelta: D(-10),
    });
    expect(r.stockAfter.toString()).toBe('0');
  });

  it('RETURN: values at the original sale snapshot, not the current average', () => {
    // stock moved to 2000 avg after the sale; original sale line was snapshotted at 1100
    const r = computeCosting({
      type: 'RETURN',
      stockBefore: D(140),
      avgCostBefore: D(2000),
      qtyDelta: D(10),
      unitCost: D(1100),
    });
    expect(r.stockAfter.toString()).toBe('150');
    // (140*2000 + 10*1100) / 150 = (280000+11000)/150 = 1940
    expect(r.avgCostAfter.toString()).toBe('1940');
    expect(r.unitCostUsed.toString()).toBe('1100');
  });

  it('RETURN: resets to the snapshot cost when resulting stock is non-positive', () => {
    const r = computeCosting({
      type: 'RETURN',
      stockBefore: D(-5),
      avgCostBefore: D(2000),
      qtyDelta: D(5),
      unitCost: D(1100),
    });
    expect(r.stockAfter.toString()).toBe('0');
    expect(r.avgCostAfter.toString()).toBe('1100');
  });

  it('COUNT_ADJUST: avgCost untouched, diff valued at current average', () => {
    const r = computeCosting({
      type: 'COUNT_ADJUST',
      stockBefore: D(150),
      avgCostBefore: D(1940),
      qtyDelta: D(-3), // shrinkage
    });
    expect(r.stockAfter.toString()).toBe('147');
    expect(r.avgCostAfter.toString()).toBe('1940');
    expect(r.costDelta.toString()).toBe('-5820');
  });
});
