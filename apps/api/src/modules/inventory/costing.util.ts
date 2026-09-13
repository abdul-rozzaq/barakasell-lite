import { Prisma } from '../../generated/prisma/client.js';
import type { LedgerType } from '../../generated/prisma/client.js';

const D = (v: string | number | Prisma.Decimal) => new Prisma.Decimal(v);

export interface CostingInput {
  type: LedgerType;
  stockBefore: Prisma.Decimal;
  avgCostBefore: Prisma.Decimal;
  qtyDelta: Prisma.Decimal; // signed, base units: + for RECEIPT/RETURN, - for SALE, either for COUNT_ADJUST
  unitCost?: Prisma.Decimal; // RECEIPT: cost paid. RETURN: original sale-line snapshot. Ignored for SALE/COUNT_ADJUST.
}

export interface CostingResult {
  stockAfter: Prisma.Decimal;
  avgCostAfter: Prisma.Decimal;
  unitCostUsed: Prisma.Decimal; // what gets written onto the ledger row's unitCost
  costDelta: Prisma.Decimal; // qtyDelta * unitCostUsed — signed inventory-value change
}

// The single place the moving-average formula lives — see plan.md B3.
// S = stockBefore, A = avgCostBefore.
export function computeCosting(input: CostingInput): CostingResult {
  const { type, stockBefore: S, avgCostBefore: A, qtyDelta } = input;
  const stockAfter = S.plus(qtyDelta);

  if (type === 'RECEIPT') {
    if (!input.unitCost) throw new Error('RECEIPT uchun unitCost majburiy');
    const c = input.unitCost;
    // S<=0 covers first-ever receipt and a negative-stock period: blending
    // against a non-positive quantity is meaningless, so we reset instead.
    const avgCostAfter = S.lte(0) ? c : S.times(A).plus(qtyDelta.times(c)).div(stockAfter);
    return { stockAfter, avgCostAfter, unitCostUsed: c, costDelta: qtyDelta.times(c) };
  }

  if (type === 'SALE') {
    // Cost is a SNAPSHOT of the current average; the average itself never
    // moves on a sale. Caller stores unitCostUsed onto SaleLine.unitCostBase.
    return { stockAfter, avgCostAfter: A, unitCostUsed: A, costDelta: qtyDelta.times(A) };
  }

  if (type === 'RETURN') {
    if (!input.unitCost) throw new Error('RETURN uchun original sotuv snapshot unitCost majburiy');
    const cSnap = input.unitCost;
    // Valued at the ORIGINAL sale snapshot, not current average, so the P&L
    // reversal exactly cancels the original COGS (plan.md "Qaytarish").
    const avgCostAfter = stockAfter.gt(0)
      ? S.times(A).plus(qtyDelta.times(cSnap)).div(stockAfter)
      : cSnap;
    return { stockAfter, avgCostAfter, unitCostUsed: cSnap, costDelta: qtyDelta.times(cSnap) };
  }

  // COUNT_ADJUST: average cost is untouched; the diff is valued at the
  // current average (plan.md "Inventarizatsiya").
  return { stockAfter, avgCostAfter: A, unitCostUsed: A, costDelta: qtyDelta.times(A) };
}

export { D };
