import { computeEan13CheckDigit } from '../catalog/barcode.util.js';

// EAN-13 "20"-"29" internal range — Product barcodes use "29" (see
// catalog/barcode.util.ts), loyalty cards use "28". The POS scan input is a
// single field for both product barcodes and customer cards, so the prefix
// is what tells them apart before either lookup runs.
const CARD_PREFIX = '28';

export function generateLoyaltyCardCode(): string {
  const body = Math.floor(Math.random() * 1e10)
    .toString()
    .padStart(10, '0');
  const first12 = CARD_PREFIX + body;
  return first12 + computeEan13CheckDigit(first12);
}

export function isLoyaltyCardCode(code: string): boolean {
  return code.length === 13 && code.startsWith(CARD_PREFIX);
}
