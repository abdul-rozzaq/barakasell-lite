// Pure matching functions for OCR'd receipt lines — no DB, fully unit-tested
// (ocr-match.util.spec.ts). Mirrors the style of costing.util.ts / loyalty.util.ts.

export type MatchStatus = 'matched' | 'uncertain' | 'unmatched';

export interface MatchCandidate {
  productId: string;
  name: string;
  sku: string;
  score: number;
}

export interface MatchableUnit {
  label: string;
  factor: number | string;
  isBase: boolean;
}

export interface MatchableProduct {
  id: string;
  name: string;
  sku: string;
  avgCost: number | string;
  units: MatchableUnit[];
}

const MATCHED_THRESHOLD = 0.6;
const UNCERTAIN_THRESHOLD = 0.35;
const MAX_CANDIDATES = 3;
const SKU_MATCH_BONUS = 0.3;
const PRICE_TOTAL_TOLERANCE = 0.01; // 1%
const AVG_COST_DEVIATION_TOLERANCE = 0.5; // 50%

// The vision prompt asks the model to transliterate Cyrillic to Latin
// itself (it knows brand names like "Кока-Кола" -> "Coca-Cola" — a lookup
// table can't), but it won't always catch everything. This is a fallback:
// plain letter-by-letter Uzbek Cyrillic -> Latin, applied to BOTH the OCR'd
// text and the catalog name before scoring, so matching still works even
// on whatever Cyrillic slips through. Apostrophes from o'/g' are dropped
// deliberately — normalize() strips punctuation right after this anyway,
// and dropping them here keeps token spelling consistent either way.
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'x', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'sh', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya',
  ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

function cyrillicToLatin(s: string): string {
  let result = '';
  for (const ch of s) {
    result += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return result;
}

export function normalize(s: string): string {
  return cyrillicToLatin(s.toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  const normalized = normalize(s);
  return normalized.length ? normalized.split(' ') : [];
}

// Dice coefficient over token sets — cheap, order-independent, tolerant of
// word order differences between OCR'd text and the catalog name.
function diceCoefficient(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let overlap = 0;
  for (const token of setA) {
    if (setB.has(token)) overlap++;
  }
  return (2 * overlap) / (setA.size + setB.size);
}

export function scoreMatch(rawName: string, name: string, sku?: string): number {
  const nameScore = diceCoefficient(tokenize(rawName), tokenize(name));
  const rawNormalized = normalize(rawName);
  const skuBonus = sku && rawNormalized.includes(normalize(sku)) ? SKU_MATCH_BONUS : 0;
  return Math.min(1, nameScore + skuBonus);
}

export function matchLine(
  rawName: string,
  products: MatchableProduct[],
): { status: MatchStatus; candidates: MatchCandidate[] } {
  const scored = products
    .map((p) => ({
      productId: p.id,
      name: p.name,
      sku: p.sku,
      score: scoreMatch(rawName, p.name, p.sku),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES);

  const top = scored[0]?.score ?? 0;
  const status: MatchStatus =
    top >= MATCHED_THRESHOLD ? 'matched' : top >= UNCERTAIN_THRESHOLD ? 'uncertain' : 'unmatched';

  return { status, candidates: scored };
}

// Falls back to the base unit when the OCR'd unit label doesn't match any
// of the product's units — a receipt line always needs SOME unit to resolve
// qtyBase/unitCostBase against.
export function resolveUnit(
  rawUnitLabel: string | undefined,
  units: MatchableUnit[],
): MatchableUnit | undefined {
  if (rawUnitLabel) {
    const target = normalize(rawUnitLabel);
    const found = units.find((u) => normalize(u.label) === target);
    if (found) return found;
  }
  return units.find((u) => u.isBase) ?? units[0];
}

export function priceWarnings(params: {
  qty: number;
  unitPrice: number;
  lineTotal?: number;
  unitCostBase: number;
  avgCost: number;
}): string[] {
  const warnings: string[] = [];
  const { qty, unitPrice, lineTotal, unitCostBase, avgCost } = params;

  if (lineTotal !== undefined) {
    const computedTotal = qty * unitPrice;
    const diff = Math.abs(computedTotal - lineTotal);
    if (lineTotal !== 0 && diff / lineTotal > PRICE_TOTAL_TOLERANCE) {
      warnings.push(
        `Hisoblangan summa (${computedTotal.toFixed(2)}) chekdagi summadan (${lineTotal.toFixed(2)}) farq qiladi`,
      );
    }
  }

  if (avgCost > 0) {
    const deviation = Math.abs(unitCostBase - avgCost) / avgCost;
    if (deviation > AVG_COST_DEVIATION_TOLERANCE) {
      warnings.push(
        `Narx (${unitCostBase.toFixed(2)}) joriy o'rtacha tannarxdan (${avgCost.toFixed(2)}) sezilarli farq qiladi`,
      );
    }
  }

  return warnings;
}
