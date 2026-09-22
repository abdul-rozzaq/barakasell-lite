import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

const LOW_STOCK_THRESHOLD = 10;

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async stockValue() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { stock: true, avgCost: true },
    });
    const totalStockValue = products.reduce(
      (acc, p) => acc.plus(p.stock.times(p.avgCost)),
      new Prisma.Decimal(0),
    );
    return { totalStockValue };
  }

  async stockList() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        stock: true,
        avgCost: true,
        units: { where: { isBase: true }, select: { price: true }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => {
      const salePrice = p.units[0]?.price ?? new Prisma.Decimal(0);
      return {
        productId: p.id,
        name: p.name,
        stock: p.stock,
        avgCost: p.avgCost,
        costValue: p.stock.times(p.avgCost),
        saleValue: p.stock.times(salePrice),
      };
    });
  }

  async dashboard() {
    const today = startOfDay(new Date());

    const [
      todaySales,
      closedShiftsToday,
      openShiftsCount,
      lowStock,
      recentShifts,
    ] = await Promise.all([
      this.prisma.sale.findMany({
        where: { soldAt: { gte: today }, status: 'COMPLETED' },
        select: {
          total: true,
          cogsTotal: true,
          lines: {
            select: { productId: true, productName: true, qtyBase: true },
          },
        },
      }),
      this.prisma.shift.aggregate({
        where: { closedAt: { gte: today } },
        _sum: { diffCash: true },
      }),
      this.prisma.shift.count({ where: { status: 'OPEN' } }),
      this.prisma.product.findMany({
        where: { isActive: true, stock: { gt: 0, lt: LOW_STOCK_THRESHOLD } },
        select: { id: true, name: true, stock: true },
        orderBy: { stock: 'asc' },
        take: 5,
      }),
      this.prisma.shift.findMany({
        include: { openedBy: { select: { name: true } } },
        orderBy: { openedAt: 'desc' },
        take: 10,
      }),
    ]);

    // Approximation: subtotal-discount minus COGS, ignoring the (typically
    // few-so'm) rounding adjustment — good enough for a KPI tile, not a
    // ledger. See plan.md "Hisobotlar".
    const todayRevenue = todaySales.reduce(
      (acc, s) => acc.plus(s.total),
      new Prisma.Decimal(0),
    );
    const todayProfit = todaySales.reduce(
      (acc, s) => acc.plus(s.total).minus(s.cogsTotal),
      new Prisma.Decimal(0),
    );

    const productTotals = new Map<
      string,
      { name: string; qty: Prisma.Decimal }
    >();
    for (const sale of todaySales) {
      for (const line of sale.lines) {
        const existing = productTotals.get(line.productId);
        if (existing) existing.qty = existing.qty.plus(line.qtyBase);
        else
          productTotals.set(line.productId, {
            name: line.productName,
            qty: line.qtyBase,
          });
      }
    }
    const topProducts = [...productTotals.entries()]
      .map(([productId, v]) => ({ productId, name: v.name, qty: v.qty }))
      .sort((a, b) => b.qty.comparedTo(a.qty))
      .slice(0, 5);

    const shiftIds = recentShifts.map((s) => s.id);
    const revenueByShift = shiftIds.length
      ? await this.prisma.sale.groupBy({
          by: ['shiftId'],
          where: { shiftId: { in: shiftIds }, status: 'COMPLETED' },
          _sum: { total: true },
        })
      : [];
    const revenueMap = new Map(
      revenueByShift.map((r) => [
        r.shiftId,
        r._sum.total ?? new Prisma.Decimal(0),
      ]),
    );

    return {
      todayRevenue,
      todayProfit,
      todayCashDiff: closedShiftsToday._sum.diffCash ?? new Prisma.Decimal(0),
      openShiftsCount,
      topProducts,
      lowStock,
      recentShifts: recentShifts.map((s) => ({
        id: s.id,
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        status: s.status,
        cashierName: s.openedBy.name,
        revenue: revenueMap.get(s.id) ?? new Prisma.Decimal(0),
        diffCash: s.diffCash,
      })),
    };
  }

  async profitReport(params: {
    from?: Date;
    to?: Date;
    groupBy: 'period' | 'product' | 'category';
  }) {
    const to = params.to ?? new Date();
    const from =
      params.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

    const sales = await this.prisma.sale.findMany({
      where: { soldAt: { gte: from, lte: to }, status: 'COMPLETED' },
      select: {
        soldAt: true,
        total: true,
        cogsTotal: true,
        lines: {
          select: {
            productId: true,
            productName: true,
            lineTotal: true,
            lineCost: true,
          },
        },
      },
    });

    if (params.groupBy === 'period') {
      const byDay = new Map<
        string,
        { revenue: Prisma.Decimal; cost: Prisma.Decimal }
      >();
      for (const sale of sales) {
        const key = startOfDay(sale.soldAt).toISOString().slice(0, 10);
        const bucket = byDay.get(key) ?? {
          revenue: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
        };
        bucket.revenue = bucket.revenue.plus(sale.total);
        bucket.cost = bucket.cost.plus(sale.cogsTotal);
        byDay.set(key, bucket);
      }
      return [...byDay.entries()]
        .map(([date, v]) => ({
          label: date,
          revenue: v.revenue,
          cost: v.cost,
          profit: v.revenue.minus(v.cost),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));
    }

    // product / category: bucket by SaleLine, since only line-level rows
    // carry cost. SaleLine has no Product relation, so a category lookup
    // needs a separate id->categoryName map for that mode.
    const categoryByProduct =
      params.groupBy === 'category'
        ? new Map(
            (
              await this.prisma.product.findMany({
                select: { id: true, category: { select: { name: true } } },
              })
            ).map((p) => [p.id, p.category?.name ?? 'Kategoriyasiz']),
          )
        : undefined;

    const buckets = new Map<
      string,
      { label: string; revenue: Prisma.Decimal; cost: Prisma.Decimal }
    >();
    for (const sale of sales) {
      for (const line of sale.lines) {
        const key =
          params.groupBy === 'category'
            ? (categoryByProduct?.get(line.productId) ?? 'Kategoriyasiz')
            : line.productId;
        const label = params.groupBy === 'category' ? key : line.productName;
        const bucket = buckets.get(key) ?? {
          label,
          revenue: new Prisma.Decimal(0),
          cost: new Prisma.Decimal(0),
        };
        bucket.revenue = bucket.revenue.plus(line.lineTotal);
        bucket.cost = bucket.cost.plus(line.lineCost);
        buckets.set(key, bucket);
      }
    }
    return [...buckets.values()]
      .map((v) => ({
        label: v.label,
        revenue: v.revenue,
        cost: v.cost,
        profit: v.revenue.minus(v.cost),
      }))
      .sort((a, b) => b.revenue.comparedTo(a.revenue));
  }

  async deadStock(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [lastSales, products] = await Promise.all([
      this.prisma.stockLedgerEntry.groupBy({
        by: ['productId'],
        where: { type: 'SALE' },
        _max: { occurredAt: true },
      }),
      this.prisma.product.findMany({
        where: { isActive: true },
        select: { id: true, name: true, stock: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    const lastSaleMap = new Map(
      lastSales.map((l) => [l.productId, l._max.occurredAt]),
    );

    return products
      .map((p) => ({
        productId: p.id,
        name: p.name,
        stock: p.stock,
        lastSoldAt: lastSaleMap.get(p.id) ?? null,
      }))
      .filter((p) => !p.lastSoldAt || p.lastSoldAt < cutoff);
  }

  // The mirror image of deadStock(): products customers keep asking for
  // (ProductRequest) that are still out of stock — a shopping-list report
  // for the owner, not something a sale/return ever touches.
  async demand(days: number) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const requests = await this.prisma.productRequest.groupBy({
      by: ['productId'],
      where: { createdAt: { gte: cutoff }, productId: { not: null } },
      _count: { _all: true },
    });
    if (requests.length === 0) return [];

    const productIds = requests.map((r) => r.productId as string);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    return requests
      .map((r) => {
        const product = productMap.get(r.productId as string);
        return {
          productId: r.productId as string,
          name: product?.name ?? "Noma'lum tovar",
          stock: product?.stock ?? new Prisma.Decimal(0),
          requestCount: r._count._all,
        };
      })
      .filter((r) => r.stock.lte(0))
      .sort((a, b) => b.requestCount - a.requestCount);
  }
}
