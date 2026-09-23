import { describe, it, expect } from 'vitest';
import { matchLine, normalize, priceWarnings, resolveUnit, scoreMatch, type MatchableProduct } from './ocr-match.util.js';

describe('normalize', () => {
  it('lowercases, strips punctuation, collapses whitespace', () => {
    expect(normalize('  Coca-Cola,  1.5L!!  ')).toBe('coca cola 1 5l');
  });

  it('transliterates Cyrillic to Latin as a fallback', () => {
    expect(normalize('Гуруч')).toBe('guruch');
    expect(normalize('Қанд')).toBe('qand');
    expect(normalize('Ёғ')).toBe('yog');
  });
});

describe('scoreMatch', () => {
  it('scores an exact name match at 1', () => {
    expect(scoreMatch('Coca Cola 1.5L', 'Coca Cola 1.5L')).toBe(1);
  });

  it('scores completely unrelated names near 0', () => {
    expect(scoreMatch('Coca Cola', 'Kraxmal')).toBe(0);
  });

  it('tolerates word-order differences (token-set based)', () => {
    const score = scoreMatch('1.5L Coca Cola', 'Coca Cola 1.5L');
    expect(score).toBe(1);
  });

  it('gives a bonus when the SKU appears in the raw text', () => {
    const withoutSku = scoreMatch('Choy paket', 'Qora choy');
    const withSku = scoreMatch('Choy paket ABC123', 'Qora choy', 'ABC123');
    expect(withSku).toBeGreaterThan(withoutSku);
  });

  it('matches a Cyrillic OCR line against a Latin catalog name', () => {
    expect(scoreMatch('Гуруч 1кг', 'Guruch 1kg')).toBe(1);
  });
});

describe('matchLine', () => {
  const products: MatchableProduct[] = [
    { id: 'p1', name: 'Coca Cola 1.5L', sku: 'CC15', avgCost: 8000, units: [] },
    { id: 'p2', name: 'Fanta 1.5L', sku: 'FN15', avgCost: 7500, units: [] },
    { id: 'p3', name: 'Kraxmal 1kg', sku: 'KR1', avgCost: 12000, units: [] },
  ];

  it('buckets a strong match as matched', () => {
    const { status, candidates } = matchLine('Coca Cola 1.5L', products);
    expect(status).toBe('matched');
    expect(candidates[0].productId).toBe('p1');
  });

  it('buckets a partial match as uncertain', () => {
    const { status } = matchLine('Cola 1.5', products);
    expect(status).toBe('uncertain');
  });

  it('buckets no reasonable match as unmatched', () => {
    const { status } = matchLine('Sovun', products);
    expect(status).toBe('unmatched');
  });

  it('returns at most 3 candidates, sorted by score descending', () => {
    const { candidates } = matchLine('Cola', products);
    expect(candidates.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1].score).toBeGreaterThanOrEqual(candidates[i].score);
    }
  });
});

describe('resolveUnit', () => {
  const units = [
    { label: 'dona', factor: 1, isBase: true },
    { label: 'karobka', factor: 24, isBase: false },
  ];

  it('finds the unit by normalized label', () => {
    expect(resolveUnit('Karobka', units)?.label).toBe('karobka');
  });

  it('falls back to the base unit when the label is unrecognized', () => {
    expect(resolveUnit('noma\'lum', units)?.label).toBe('dona');
  });

  it('falls back to the base unit when no label is given', () => {
    expect(resolveUnit(undefined, units)?.label).toBe('dona');
  });
});

describe('priceWarnings', () => {
  it('warns when qty*unitPrice diverges from the OCR total by more than 1%', () => {
    const warnings = priceWarnings({
      qty: 10,
      unitPrice: 1000,
      lineTotal: 12000, // computed 10000 vs 12000 — big diff
      unitCostBase: 1000,
      avgCost: 1000,
    });
    expect(warnings.some((w) => w.includes('summa'))).toBe(true);
  });

  it('does not warn when the total matches within tolerance', () => {
    const warnings = priceWarnings({
      qty: 10,
      unitPrice: 1000,
      lineTotal: 10005,
      unitCostBase: 1000,
      avgCost: 1000,
    });
    expect(warnings.some((w) => w.includes('summa'))).toBe(false);
  });

  it('warns when unitCostBase deviates from avgCost by more than 50%', () => {
    const warnings = priceWarnings({
      qty: 1,
      unitPrice: 5000,
      unitCostBase: 5000,
      avgCost: 1000,
    });
    expect(warnings.some((w) => w.includes('tannarx'))).toBe(true);
  });

  it('skips the avgCost check when there is no prior cost (new product)', () => {
    const warnings = priceWarnings({
      qty: 1,
      unitPrice: 5000,
      unitCostBase: 5000,
      avgCost: 0,
    });
    expect(warnings.some((w) => w.includes('tannarx'))).toBe(false);
  });
});
