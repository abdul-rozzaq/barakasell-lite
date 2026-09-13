import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type LedgerType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { computeCosting } from './costing.util.js';

export interface ApplyMovementInput {
  productId: string;
  type: LedgerType;
  qtyDelta: Prisma.Decimal | number | string;
  unitCost?: Prisma.Decimal | number | string;
  refType: string;
  refId: string;
  refLineId?: string;
  userId?: string;
  note?: string;
  occurredAt?: Date;
}

// The ONLY place Product.stock / Product.avgCost are written. Every writer
// (receiving, sales, returns, counts — see plan.md B3) goes through here.
// Callers are responsible for locking the involved Product rows (in a fixed,
// ascending-id order to avoid deadlocks) BEFORE calling this, via
// StockService.lockProducts, inside their own document-level transaction.
export interface DriftRow {
  productId: string;
  name: string;
  cachedStock: Prisma.Decimal;
  ledgerStock: Prisma.Decimal;
  cachedAvgCost: Prisma.Decimal;
  ledgerAvgCost: Prisma.Decimal;
}

@Injectable()
export class StockService {
  constructor(private readonly prisma: PrismaService) {}

  async lockProducts(tx: Prisma.TransactionClient, productIds: string[]): Promise<void> {
    const unique = [...new Set(productIds)].sort();
    if (unique.length === 0) return;
    await tx.$queryRaw`SELECT id FROM "Product" WHERE id = ANY(${unique}) ORDER BY id FOR UPDATE`;
  }

  async applyMovement(tx: Prisma.TransactionClient, input: ApplyMovementInput) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: input.productId } });

    const qtyDelta = new Prisma.Decimal(input.qtyDelta);
    const unitCost = input.unitCost !== undefined ? new Prisma.Decimal(input.unitCost) : undefined;

    const result = computeCosting({
      type: input.type,
      stockBefore: product.stock,
      avgCostBefore: product.avgCost,
      qtyDelta,
      unitCost,
    });

    if (input.type === 'SALE' && result.stockAfter.lt(0)) {
      const settings = await tx.settings.findUnique({ where: { id: 1 } });
      if (!settings?.allowNegativeStock) {
        throw new ConflictException(
          `Qoldiq yetarli emas: "${product.name}" uchun manfiy qoldiqqa ruxsat berilmagan`,
        );
      }
    }

    const entry = await tx.stockLedgerEntry.create({
      data: {
        productId: input.productId,
        type: input.type,
        qtyDelta,
        balanceAfter: result.stockAfter,
        unitCost: result.unitCostUsed,
        costDelta: result.costDelta,
        avgCostAfter: result.avgCostAfter,
        refType: input.refType,
        refId: input.refId,
        refLineId: input.refLineId,
        userId: input.userId,
        note: input.note,
        occurredAt: input.occurredAt,
      },
    });

    await tx.product.update({
      where: { id: input.productId },
      data: {
        stock: result.stockAfter,
        avgCost: result.avgCostAfter,
        lastLedgerSeq: entry.seq,
      },
    });

    return entry;
  }

  // Re-derivation, not a second calculation: each ledger row already carries
  // its own cumulative balanceAfter/avgCostAfter, so the "recomputed" truth
  // for a product is simply the latest row's snapshot by seq. See plan.md B5.
  async verify(): Promise<DriftRow[]> {
    const latest = await this.prisma.$queryRaw<
      { productId: string; balanceAfter: Prisma.Decimal; avgCostAfter: Prisma.Decimal }[]
    >`SELECT DISTINCT ON ("productId") "productId", "balanceAfter", "avgCostAfter"
       FROM "StockLedgerEntry" ORDER BY "productId", seq DESC`;
    const latestByProduct = new Map(latest.map((l) => [l.productId, l]));

    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, stock: true, avgCost: true },
    });

    const drifts: DriftRow[] = [];
    for (const p of products) {
      const expected = latestByProduct.get(p.id);
      const ledgerStock = expected ? new Prisma.Decimal(expected.balanceAfter) : new Prisma.Decimal(0);
      const ledgerAvgCost = expected ? new Prisma.Decimal(expected.avgCostAfter) : new Prisma.Decimal(0);
      if (!p.stock.equals(ledgerStock) || !p.avgCost.equals(ledgerAvgCost)) {
        drifts.push({
          productId: p.id,
          name: p.name,
          cachedStock: p.stock,
          ledgerStock,
          cachedAvgCost: p.avgCost,
          ledgerAvgCost,
        });
      }
    }
    return drifts;
  }

  async repair(): Promise<{ repairedCount: number; drifts: DriftRow[] }> {
    const drifts = await this.verify();
    for (const d of drifts) {
      await this.prisma.product.update({
        where: { id: d.productId },
        data: { stock: d.ledgerStock, avgCost: d.ledgerAvgCost },
      });
    }
    return { repairedCount: drifts.length, drifts };
  }

  listLedger(filter: { productId?: string; type?: LedgerType; from?: Date; to?: Date; cursor?: string; take?: number }) {
    const take = Math.min(filter.take ?? 50, 200);
    return this.prisma.stockLedgerEntry.findMany({
      where: {
        productId: filter.productId,
        type: filter.type,
        occurredAt: filter.from || filter.to ? { gte: filter.from, lte: filter.to } : undefined,
      },
      orderBy: { seq: 'desc' },
      take,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
  }

  movementsForProduct(productId: string) {
    return this.prisma.stockLedgerEntry.findMany({
      where: { productId },
      orderBy: { seq: 'desc' },
      select: { occurredAt: true, type: true, qtyDelta: true, balanceAfter: true, refType: true, refId: true },
      take: 200,
    });
  }
}
