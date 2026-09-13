import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CreateReceiptDto } from './dto/create-receipt.dto.js';

const RECEIPT_INCLUDE = {
  supplier: true,
  lines: true,
} satisfies Prisma.ReceiptInclude;

@Injectable()
export class ReceiptsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.receipt.findMany({
      include: { supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const receipt = await this.prisma.receipt.findUnique({
      where: { id },
      include: RECEIPT_INCLUDE,
    });
    if (!receipt) throw new NotFoundException('Hujjat topilmadi');
    return receipt;
  }

  async create(dto: CreateReceiptDto, userId: string) {
    const lines = await this.resolveLines(dto.lines);
    const code = await this.nextCode();
    return this.prisma.receipt.create({
      data: {
        code,
        supplierId: dto.supplierId,
        note: dto.note,
        createdById: userId,
        lines: { create: lines },
      },
      include: RECEIPT_INCLUDE,
    });
  }

  async update(id: string, dto: CreateReceiptDto) {
    const receipt = await this.assertDraft(id);
    const lines = await this.resolveLines(dto.lines);
    return this.prisma.$transaction(async (tx) => {
      await tx.receiptLine.deleteMany({ where: { receiptId: receipt.id } });
      return tx.receipt.update({
        where: { id: receipt.id },
        data: {
          supplierId: dto.supplierId,
          note: dto.note,
          lines: { create: lines },
        },
        include: RECEIPT_INCLUDE,
      });
    });
  }

  async post(id: string, userId: string) {
    const receipt = await this.assertDraft(id);
    if (receipt.lines.length === 0) {
      throw new BadRequestException("Bo'sh hujjatni tasdiqlab bo'lmaydi");
    }

    return this.prisma.$transaction(async (tx) => {
      await this.stockService.lockProducts(
        tx,
        receipt.lines.map((l) => l.productId),
      );

      for (const line of receipt.lines) {
        await this.stockService.applyMovement(tx, {
          productId: line.productId,
          type: 'RECEIPT',
          qtyDelta: line.qtyBase,
          unitCost: line.unitCostBase,
          refType: 'receipt',
          refId: receipt.id,
          refLineId: line.id,
          userId,
        });
      }

      const posted = await tx.receipt.update({
        where: { id: receipt.id },
        data: { status: 'POSTED', postedAt: new Date() },
        include: RECEIPT_INCLUDE,
      });

      await this.auditService.write(tx, {
        action: 'Kirim tasdiqlandi',
        entity: 'Receipt',
        entityId: receipt.id,
        detail: { code: receipt.code, lineCount: receipt.lines.length },
        userId,
      });

      return posted;
    });
  }

  private async resolveLines(
    lines: {
      productId: string;
      unitLabel: string;
      qtyInUnit: number;
      unitCostPack: number;
    }[],
  ) {
    const resolved = [];
    for (const line of lines) {
      const unit = await this.prisma.productUnit.findUnique({
        where: {
          productId_label: { productId: line.productId, label: line.unitLabel },
        },
      });
      if (!unit) {
        throw new BadRequestException(
          `"${line.unitLabel}" birligi shu tovar uchun topilmadi`,
        );
      }
      const qtyInUnit = new Prisma.Decimal(line.qtyInUnit);
      const unitCostPack = new Prisma.Decimal(line.unitCostPack);
      const qtyBase = qtyInUnit.times(unit.factor);
      const unitCostBase = unitCostPack.div(unit.factor);
      resolved.push({
        productId: line.productId,
        unitLabel: unit.label,
        unitFactor: unit.factor,
        qtyInUnit,
        qtyBase,
        unitCostPack,
        unitCostBase,
        lineTotal: qtyInUnit.times(unitCostPack),
      });
    }
    return resolved;
  }

  private async assertDraft(id: string) {
    const receipt = await this.findOne(id);
    if (receipt.status !== 'DRAFT') {
      throw new ConflictException(
        'Hujjat allaqachon tasdiqlangan yoki bekor qilingan',
      );
    }
    return receipt;
  }

  private async nextCode(): Promise<string> {
    const [{ nextval }] = await this.prisma.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('receipt_code_seq')`;
    return `K-${nextval.toString().padStart(6, '0')}`;
  }
}
