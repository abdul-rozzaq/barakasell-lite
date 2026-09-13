import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';
import { CreateSupplierDto } from './dto/create-supplier.dto.js';

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    const [suppliers, receipts] = await Promise.all([
      this.prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.receipt.findMany({
        where: { supplierId: { not: null } },
        select: {
          supplierId: true,
          createdAt: true,
          status: true,
          lines: { select: { lineTotal: true } },
        },
      }),
    ]);

    const lastReceiptAt = new Map<string, Date>();
    const totalPurchase = new Map<string, Prisma.Decimal>();
    for (const receipt of receipts) {
      const supplierId = receipt.supplierId!;
      const current = lastReceiptAt.get(supplierId);
      if (!current || receipt.createdAt > current)
        lastReceiptAt.set(supplierId, receipt.createdAt);

      if (receipt.status === 'POSTED') {
        const lineSum = receipt.lines.reduce(
          (acc, l) => acc.plus(l.lineTotal),
          new Prisma.Decimal(0),
        );
        totalPurchase.set(
          supplierId,
          (totalPurchase.get(supplierId) ?? new Prisma.Decimal(0)).plus(
            lineSum,
          ),
        );
      }
    }

    return suppliers.map((s) => ({
      ...s,
      lastReceiptAt: lastReceiptAt.get(s.id) ?? null,
      totalPurchase: totalPurchase.get(s.id) ?? new Prisma.Decimal(0),
    }));
  }

  create(dto: CreateSupplierDto) {
    return this.prisma.supplier.create({ data: dto });
  }
}
