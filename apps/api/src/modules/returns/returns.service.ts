import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { StockService } from '../inventory/stock.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CustomerDebtService } from '../customers/customer-debt.service.js';
import { ShiftsService } from '../shifts/shifts.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { proportionalPointsReversal } from '../loyalty/loyalty.util.js';
import {
  FISCAL_GATEWAY,
  type FiscalGateway,
} from '../fiscal/fiscal.gateway.js';
import { computeRefund } from './refund.util.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { CreateReturnDto } from './dto/create-return.dto.js';

const RETURN_INCLUDE = { lines: true } satisfies Prisma.SaleReturnInclude;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
    private readonly customerDebtService: CustomerDebtService,
    private readonly shiftsService: ShiftsService,
    private readonly loyaltyService: LoyaltyService,
    @Inject(FISCAL_GATEWAY) private readonly fiscalGateway: FiscalGateway,
  ) {}

  async findOne(id: string) {
    const saleReturn = await this.prisma.saleReturn.findUnique({
      where: { id },
      include: RETURN_INCLUDE,
    });
    if (!saleReturn) throw new NotFoundException('Qaytarish topilmadi');
    return saleReturn;
  }

  async create(dto: CreateReturnDto, user: AuthUser) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.saleReturn.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: RETURN_INCLUDE,
      });
      if (existing) return existing;
    }

    const sale = await this.prisma.sale.findUnique({
      where: { id: dto.saleId },
      include: { lines: true },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    if (sale.status !== 'COMPLETED') {
      throw new ConflictException("Bekor qilingan sotuvni qaytarib bo'lmaydi");
    }
    if (dto.refundTender === 'CREDIT' && !sale.customerId) {
      throw new BadRequestException(
        "Bu sotuvda mijoz yo'q, nasiyaga qaytarib bo'lmaydi",
      );
    }

    const resolvedLines = dto.lines.map((line) => {
      const saleLine = sale.lines.find((l) => l.id === line.saleLineId);
      if (!saleLine)
        throw new BadRequestException(
          `Sotuv qatori topilmadi: ${line.saleLineId}`,
        );
      const qtyBase = new Prisma.Decimal(line.qtyBase);
      const available = saleLine.qtyBase.minus(saleLine.returnedQtyBase);
      if (qtyBase.gt(available)) {
        throw new ConflictException(
          `"${saleLine.productName}" uchun qaytarish miqdori mavjud miqdordan ko'p`,
        );
      }
      return { saleLine, qtyBase };
    });

    const shift = await this.shiftsService.findOpenShift(user.sub);

    const saleReturn = await this.prisma.$transaction(async (tx) => {
      await this.stockService.lockProducts(
        tx,
        resolvedLines.map((l) => l.saleLine.productId),
      );

      const code = await this.nextCode(tx);
      const created = await tx.saleReturn.create({
        data: {
          code,
          saleId: sale.id,
          idempotencyKey: dto.idempotencyKey,
          refundTotal: 0,
          refundTender: dto.refundTender,
          costReversed: 0,
          shiftId: shift?.id,
          userId: user.sub,
          reason: dto.reason,
        },
      });

      let refundTotal = new Prisma.Decimal(0);
      let costReversed = new Prisma.Decimal(0);
      for (const { saleLine, qtyBase } of resolvedLines) {
        const entry = await this.stockService.applyMovement(tx, {
          productId: saleLine.productId,
          type: 'RETURN',
          qtyDelta: qtyBase,
          unitCost: saleLine.unitCostBase,
          refType: 'return',
          refId: created.id,
          refLineId: saleLine.id,
          userId: user.sub,
        });
        const lineCost = qtyBase.times(entry.unitCost);
        const refundAmount = computeRefund({
          lineTotal: saleLine.lineTotal,
          originalQtyBase: saleLine.qtyBase,
          returnQtyBase: qtyBase,
          saleSubtotal: sale.subtotal,
          saleDiscountAmount: sale.discountAmount,
          saleLoyaltyDiscount: sale.loyaltyDiscount,
        });
        refundTotal = refundTotal.plus(refundAmount);
        costReversed = costReversed.plus(lineCost);

        await tx.saleReturnLine.create({
          data: {
            returnId: created.id,
            saleLineId: saleLine.id,
            productId: saleLine.productId,
            qtyBase,
            refundAmount,
            unitCostBase: saleLine.unitCostBase,
          },
        });

        await tx.saleLine.update({
          where: { id: saleLine.id },
          data: { returnedQtyBase: saleLine.returnedQtyBase.plus(qtyBase) },
        });
      }

      if (dto.refundTender === 'CREDIT' && sale.customerId) {
        await this.customerDebtService.write(tx, {
          customerId: sale.customerId,
          type: 'RETURN_CREDIT',
          amount: refundTotal,
          tender: 'CREDIT',
          refType: 'SaleReturn',
          refId: created.id,
          userId: user.sub,
        });
      }

      if (sale.loyaltyPointsEarned > 0 && sale.customerId) {
        const reversedPoints = proportionalPointsReversal(
          sale.loyaltyPointsEarned,
          refundTotal,
          sale.total,
        );
        if (reversedPoints > 0) {
          await this.loyaltyService.write(tx, {
            customerId: sale.customerId,
            type: 'RETURN_REVERSAL',
            points: reversedPoints,
            refType: 'SaleReturn',
            refId: created.id,
            userId: user.sub,
          });
        }
      }

      // Give back a share of the points the customer spent on this sale,
      // proportional to how much is being refunded — they didn't get the
      // full value of what those points paid for.
      if (sale.loyaltyPointsRedeemed > 0 && sale.customerId) {
        const refundedPoints = proportionalPointsReversal(
          sale.loyaltyPointsRedeemed,
          refundTotal,
          sale.total,
        );
        if (refundedPoints > 0) {
          await this.loyaltyService.write(tx, {
            customerId: sale.customerId,
            type: 'ADJUSTMENT',
            points: refundedPoints,
            refType: 'SaleReturn',
            refId: created.id,
            userId: user.sub,
            note: 'Qaytarish — ishlatilgan ball qisman qaytarildi',
          });
        }
      }

      const finalized = await tx.saleReturn.update({
        where: { id: created.id },
        data: { refundTotal, costReversed },
        include: RETURN_INCLUDE,
      });

      await this.auditService.write(tx, {
        action: 'Qaytarish',
        entity: 'SaleReturn',
        entityId: created.id,
        detail: {
          code,
          saleCode: sale.code,
          refundTotal: refundTotal.toString(),
        },
        userId: user.sub,
      });

      return finalized;
    });

    await this.fiscalGateway.registerReturn({
      returnId: saleReturn.id,
      code: saleReturn.code,
      saleCode: sale.code,
      refundTotal: saleReturn.refundTotal,
    });

    return saleReturn;
  }

  private async nextCode(tx: Prisma.TransactionClient): Promise<string> {
    const [{ nextval }] = await tx.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('return_code_seq')`;
    return `Q-${nextval.toString().padStart(6, '0')}`;
  }
}
