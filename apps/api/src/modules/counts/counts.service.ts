import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateInventoryCountDto } from './dto/create-count.dto.js';
import { UpdateCountLinesDto } from './dto/update-count-lines.dto.js';

const COUNT_INCLUDE = { lines: true } satisfies Prisma.InventoryCountInclude;

@Injectable()
export class CountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.inventoryCount.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  }

  async findOne(id: string) {
    const count = await this.prisma.inventoryCount.findUnique({ where: { id }, include: COUNT_INCLUDE });
    if (!count) throw new NotFoundException('Hujjat topilmadi');
    return count;
  }

  async create(dto: CreateInventoryCountDto, userId: string) {
    const products = await this.prisma.product.findMany({
      where: { isActive: true, id: dto.productIds ? { in: dto.productIds } : undefined },
      select: { id: true, stock: true },
    });

    const code = await this.nextCode();
    return this.prisma.inventoryCount.create({
      data: {
        code,
        note: dto.note,
        createdById: userId,
        lines: {
          // countedQty defaults to the current stock (0 diff) until the
          // physical count edits it via PATCH .../lines.
          create: products.map((p) => ({
            productId: p.id,
            expectedQty: p.stock,
            countedQty: p.stock,
            diffQty: 0,
            unitCost: 0,
            diffValue: 0,
          })),
        },
      },
      include: COUNT_INCLUDE,
    });
  }

  async updateLines(id: string, dto: UpdateCountLinesDto) {
    const count = await this.assertDraft(id);
    for (const line of dto.lines) {
      const existing = count.lines.find((l) => l.productId === line.productId);
      if (!existing) {
        throw new BadRequestException(`Tovar bu hujjatda yo'q: ${line.productId}`);
      }
      await this.prisma.inventoryCountLine.update({
        where: { id: existing.id },
        data: { countedQty: line.countedQty },
      });
    }
    return this.findOne(id);
  }

  async post(id: string, userId: string) {
    const count = await this.assertDraft(id);
    if (count.lines.length === 0) {
      throw new BadRequestException('Bo\'sh hujjatni tasdiqlab bo\'lmaydi');
    }

    return this.prisma.$transaction(async (tx) => {
      await this.stockService.lockProducts(
        tx,
        count.lines.map((l) => l.productId),
      );

      let totalDiffValue = new Prisma.Decimal(0);
      for (const line of count.lines) {
        const product = await tx.product.findUniqueOrThrow({ where: { id: line.productId } });
        // Expected qty is frozen HERE, from the locked row — not from whatever
        // was displayed when the count was created — so a sale racing the
        // count can't be silently absorbed. See plan.md B8.
        const expectedQty = product.stock;
        const diffQty = new Prisma.Decimal(line.countedQty).minus(expectedQty);
        const unitCost = product.avgCost;
        const diffValue = diffQty.times(unitCost);
        totalDiffValue = totalDiffValue.plus(diffValue);

        if (!diffQty.isZero()) {
          await this.stockService.applyMovement(tx, {
            productId: line.productId,
            type: 'COUNT_ADJUST',
            qtyDelta: diffQty,
            refType: 'count',
            refId: count.id,
            refLineId: line.id,
            userId,
          });
        }

        await tx.inventoryCountLine.update({
          where: { id: line.id },
          data: { expectedQty, countedQty: line.countedQty, diffQty, unitCost, diffValue },
        });
      }

      const posted = await tx.inventoryCount.update({
        where: { id: count.id },
        data: { status: 'POSTED', postedAt: new Date(), totalDiffValue },
        include: COUNT_INCLUDE,
      });

      await this.auditService.write(tx, {
        action: 'Inventarizatsiya',
        entity: 'InventoryCount',
        entityId: count.id,
        detail: { code: count.code, totalDiffValue: totalDiffValue.toString() },
        userId,
      });

      return posted;
    });
  }

  private async assertDraft(id: string) {
    const count = await this.findOne(id);
    if (count.status !== 'DRAFT') {
      throw new ConflictException('Hujjat allaqachon tasdiqlangan yoki bekor qilingan');
    }
    return count;
  }

  private async nextCode(): Promise<string> {
    const [{ nextval }] = await this.prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('count_code_seq')`;
    return `INV-${nextval.toString().padStart(6, '0')}`;
  }
}
