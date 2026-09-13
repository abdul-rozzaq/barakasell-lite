import { describe, it, expect } from 'vitest';
import { Prisma } from '../../generated/prisma/client.js';
import { applyRounding } from './rounding.util.js';

const D = (v: string | number) => new Prisma.Decimal(v);

describe('applyRounding', () => {
  it('NONE leaves the total untouched', () => {
    const r = applyRounding(D(128437), 'NONE');
    expect(r.rounded.toString()).toBe('128437');
    expect(r.adj.toString()).toBe('0');
  });

  it('R10 rounds down when remainder < half the step', () => {
    const r = applyRounding(D(128434), 'R10');
    expect(r.rounded.toString()).toBe('128430');
    expect(r.adj.toString()).toBe('-4');
  });

  it('R100 rounds up when remainder >= half the step', () => {
    const r = applyRounding(D(128450), 'R100');
    expect(r.rounded.toString()).toBe('128500');
    expect(r.adj.toString()).toBe('50');
  });

  it('R1000 handles an already-exact total with a zero adjustment', () => {
    const r = applyRounding(D(129000), 'R1000');
    expect(r.rounded.toString()).toBe('129000');
    expect(r.adj.toString()).toBe('0');
  });

  it('R10 on a total below the step still rounds toward the nearest multiple', () => {
    const r = applyRounding(D(4), 'R10');
    expect(r.rounded.toString()).toBe('0');
    expect(r.adj.toString()).toBe('-4');
  });
});
