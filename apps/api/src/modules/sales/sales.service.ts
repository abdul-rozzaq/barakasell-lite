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
import { SettingsService } from '../settings/settings.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { computeEarnedPoints, computeRedeemValue, maxRedeemablePoints } from '../loyalty/loyalty.util.js';
import {
  FISCAL_GATEWAY,
  type FiscalGateway,
} from '../fiscal/fiscal.gateway.js';
import { applyRounding } from '../settings/rounding.util.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { CreateSaleDto } from './dto/create-sale.dto.js';
import { CreateSaleTenderDto } from './dto/create-sale-tender.dto.js';
import { SyncSalesDto } from './dto/sync-sales.dto.js';

const SALE_INCLUDE = {
  lines: true,
  tenders: true,
  cashier: { select: { name: true } },
} satisfies Prisma.SaleInclude;

type TxClient = Prisma.TransactionClient;

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockService: StockService,
    private readonly auditService: AuditService,
    private readonly customerDebtService: CustomerDebtService,
    private readonly shiftsService: ShiftsService,
    private readonly settingsService: SettingsService,
    private readonly loyaltyService: LoyaltyService,
    @Inject(FISCAL_GATEWAY) private readonly fiscalGateway: FiscalGateway,
  ) {}

  findAll(filter: {
    from?: Date;
    to?: Date;
    shiftId?: string;
    customerId?: string;
    cursor?: string;
    take?: number;
  }) {
    const take = Math.min(filter.take ?? 50, 200);
    return this.prisma.sale.findMany({
      where: {
        shiftId: filter.shiftId,
        customerId: filter.customerId,
        soldAt:
          filter.from || filter.to
            ? { gte: filter.from, lte: filter.to }
            : undefined,
      },
      include: SALE_INCLUDE,
      orderBy: { soldAt: 'desc' },
      take,
      ...(filter.cursor ? { cursor: { id: filter.cursor }, skip: 1 } : {}),
    });
  }

  async findOne(id: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    return sale;
  }

  async findByCode(code: string) {
    const sale = await this.prisma.sale.findUnique({
      where: { code },
      include: SALE_INCLUDE,
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    return sale;
  }

  async create(dto: CreateSaleDto, idempotencyKey: string, user: AuthUser) {
    // Offline POS retries the same sale after reconnecting; return the
    // already-created row instead of erroring or double-selling stock.
    const existing = await this.prisma.sale.findUnique({
      where: { idempotencyKey },
      include: SALE_INCLUDE,
    });
    if (existing) return existing;

    const shift = await this.shiftsService.requireOpenShift(user.sub);

    const hasCredit = dto.tenders.some((t) => t.type === 'CREDIT');
    if (hasCredit && !dto.customerId) {
      throw new BadRequestException('Nasiya uchun mijoz tanlanishi kerak');
    }

    const settings = await this.settingsService.get();

    const sale = await this.prisma.$transaction(async (tx) => {
      await this.stockService.lockProducts(
        tx,
        dto.lines.map((l) => l.productId),
      );

      const resolvedLines = await this.resolveLines(tx, dto.lines);
      const subtotal = resolvedLines.reduce(
        (acc, l) => acc.plus(l.lineTotal),
        new Prisma.Decimal(0),
      );

      const discountAmount = new Prisma.Decimal(dto.discountAmount ?? 0);
      if (discountAmount.gt(subtotal)) {
        throw new BadRequestException(
          "Chegirma summasi jami summadan katta bo'lishi mumkin emas",
        );
      }
      const netBeforeLoyalty = subtotal.minus(discountAmount);

      // Ball bilan to'lash: capped by the customer's own balance and by
      // Settings.loyaltyMaxRedeemPercent of what's left to pay after the
      // flat discount — see loyalty.util.ts maxRedeemablePoints(). Reversed
      // proportionally on a return, see refund.util.ts / returns.service.ts.
      let redeemPoints = 0;
      let loyaltyDiscount = new Prisma.Decimal(0);
      if (dto.redeemPoints && dto.redeemPoints > 0) {
        if (!dto.customerId) {
          throw new BadRequestException(
            "Ball bilan to'lash uchun mijoz tanlanishi kerak",
          );
        }
        if (!settings.loyaltyEnabled) {
          throw new BadRequestException("Loyalty dasturi yoqilmagan");
        }
        const customer = await tx.customer.findUniqueOrThrow({
          where: { id: dto.customerId },
        });
        const maxPoints = maxRedeemablePoints(netBeforeLoyalty, customer.pointsBalance, settings);
        if (dto.redeemPoints > maxPoints) {
          throw new BadRequestException(
            `Ko'pi bilan ${maxPoints} ball ishlatish mumkin`,
          );
        }
        redeemPoints = dto.redeemPoints;
        loyaltyDiscount = computeRedeemValue(redeemPoints, settings);
      }

      const { rounded: total, adj: roundingAdj } = applyRounding(
        netBeforeLoyalty.minus(loyaltyDiscount),
        settings.roundingMode,
      );

      const { paidAmount, changeAmount } = this.settleTenders(
        dto.tenders,
        total,
      );
      if (paidAmount.lt(total)) {
        throw new BadRequestException("To'lov miqdori jami summadan kam");
      }

      const code = await this.nextCode(tx);
      const soldAt = dto.soldAt ? new Date(dto.soldAt) : new Date();

      const created = await tx.sale.create({
        data: {
          code,
          idempotencyKey,
          shiftId: shift.id,
          cashierId: user.sub,
          customerId: dto.customerId,
          subtotal,
          discountAmount,
          loyaltyDiscount,
          loyaltyPointsRedeemed: redeemPoints,
          roundingAdj,
          total,
          paidAmount,
          changeAmount,
          cogsTotal: 0,
          soldAt,
        },
      });

      let cogsTotal = new Prisma.Decimal(0);
      for (const line of resolvedLines) {
        const entry = await this.stockService.applyMovement(tx, {
          productId: line.productId,
          type: 'SALE',
          qtyDelta: line.qtyBase.negated(),
          refType: 'sale',
          refId: created.id,
          userId: user.sub,
        });
        const lineCost = line.qtyBase.times(entry.unitCost);
        cogsTotal = cogsTotal.plus(lineCost);

        await tx.saleLine.create({
          data: {
            saleId: created.id,
            productId: line.productId,
            productName: line.productName,
            unitLabel: line.unitLabel,
            unitFactor: line.unitFactor,
            qtyInUnit: line.qtyInUnit,
            qtyBase: line.qtyBase,
            unitPrice: line.unitPrice,
            unitDiscountAmount: line.unitDiscountAmount,
            lineTotal: line.lineTotal,
            unitCostBase: entry.unitCost,
            lineCost,
          },
        });
      }

      await tx.saleTender.createMany({
        data: dto.tenders.map((t) => ({
          saleId: created.id,
          type: t.type,
          amount: new Prisma.Decimal(t.amount),
        })),
      });

      if (hasCredit && dto.customerId) {
        const creditAmount = dto.tenders
          .filter((t) => t.type === 'CREDIT')
          .reduce((acc, t) => acc.plus(t.amount), new Prisma.Decimal(0));
        await this.customerDebtService.write(tx, {
          customerId: dto.customerId,
          type: 'CREDIT_SALE',
          amount: creditAmount,
          tender: 'CREDIT',
          refType: 'Sale',
          refId: created.id,
          userId: user.sub,
        });
      }

      if (redeemPoints > 0 && dto.customerId) {
        await this.loyaltyService.write(tx, {
          customerId: dto.customerId,
          type: 'REDEEM',
          points: redeemPoints,
          refType: 'Sale',
          refId: created.id,
          userId: user.sub,
        });
      }

      // Points earn on whatever customer is attached, regardless of tender
      // mix (not just CREDIT sales) — see plan.md loyalty section. Earns on
      // `total`, which already reflects the redeem discount above — points
      // don't accrue on money the customer didn't actually pay.
      let loyaltyPointsEarned = 0;
      if (settings.loyaltyEnabled && dto.customerId) {
        loyaltyPointsEarned = computeEarnedPoints(total, settings);
        if (loyaltyPointsEarned > 0) {
          await this.loyaltyService.write(tx, {
            customerId: dto.customerId,
            type: 'EARN',
            points: loyaltyPointsEarned,
            refType: 'Sale',
            refId: created.id,
            userId: user.sub,
          });
        }
      }

      const finalized = await tx.sale.update({
        where: { id: created.id },
        data: { cogsTotal, loyaltyPointsEarned },
        include: SALE_INCLUDE,
      });

      await this.auditService.write(tx, {
        action: 'Sotuv',
        entity: 'Sale',
        entityId: created.id,
        detail: {
          code,
          total: total.toString(),
          discountAmount: discountAmount.toString(),
        },
        userId: user.sub,
      });

      return finalized;
    });

    // Fiscal registration happens AFTER commit — a fiscal failure must never
    // roll back an already-completed sale. See plan.md "Kelajakka seam".
    const fiscalResult = await this.fiscalGateway.registerSale({
      saleId: sale.id,
      code: sale.code,
      soldAt: sale.soldAt,
      total: sale.total,
      lines: sale.lines.map((l) => ({
        name: l.productName,
        qtyBase: l.qtyBase,
        unitPrice: l.unitPrice,
        lineTotal: l.lineTotal,
      })),
      tenders: sale.tenders.map((t) => ({ type: t.type, amount: t.amount })),
      cashierId: sale.cashierId,
    });
    if (fiscalResult.status !== sale.fiscalStatus) {
      await this.prisma.sale.update({
        where: { id: sale.id },
        data: {
          fiscalStatus: fiscalResult.status,
          fiscalRef: fiscalResult.ref,
        },
      });
    }

    return sale;
  }

  async sync(dto: SyncSalesDto, user: AuthUser) {
    const results: Array<{
      idempotencyKey: string;
      status: 'created' | 'duplicate' | 'failed';
      saleId?: string;
      message?: string;
    }> = [];
    for (const item of dto.sales) {
      try {
        const before = await this.prisma.sale.findUnique({
          where: { idempotencyKey: item.idempotencyKey },
        });
        const sale = await this.create(item, item.idempotencyKey, user);
        results.push({
          idempotencyKey: item.idempotencyKey,
          status: before ? 'duplicate' : 'created',
          saleId: sale.id,
        });
      } catch (err) {
        results.push({
          idempotencyKey: item.idempotencyKey,
          status: 'failed',
          message: err instanceof Error ? err.message : "Noma'lum xatolik",
        });
      }
    }
    return results;
  }


  async voidSale(id: string, user: AuthUser) {
    const sale = await this.prisma.sale.findUnique({
      where: { id },
      include: { lines: true, tenders: true, returns: { select: { id: true } } },
    });
    if (!sale) throw new NotFoundException('Sotuv topilmadi');
    if (sale.status === 'VOIDED')
      throw new ConflictException('Sotuv allaqachon bekor qilingan');
    if (sale.returns.length > 0)
      throw new ConflictException(
        "Qaytarishlar mavjud sotuvni bekor qilib bo'lmaydi",
      );

    return this.prisma.$transaction(async (tx) => {
      const productIds = sale.lines.map((l) => l.productId);
      await this.stockService.lockProducts(tx, productIds);

      for (const line of sale.lines) {
        await this.stockService.applyMovement(tx, {
          productId: line.productId,
          type: 'RETURN',
          qtyDelta: line.qtyBase,          // positive — adding stock back
          unitCost: line.unitCostBase,
          refType: 'sale_void',
          refId: sale.id,
          refLineId: line.id,
          userId: user.sub,
          note: 'Sotuv bekor qilindi',
        });
      }

      // Reverse credit debt if applicable
      const creditAmount = sale.tenders
        .filter((t) => t.type === 'CREDIT')
        .reduce((acc, t) => acc.plus(t.amount), new Prisma.Decimal(0));
      if (creditAmount.gt(0) && sale.customerId) {
        await this.customerDebtService.write(tx, {
          customerId: sale.customerId,
          type: 'RETURN_CREDIT',
          amount: creditAmount,
          refType: 'SaleVoid',
          refId: sale.id,
          userId: user.sub,
          note: 'Sotuv bekor qilindi',
        });
      }

      if (sale.loyaltyPointsEarned > 0 && sale.customerId) {
        await this.loyaltyService.write(tx, {
          customerId: sale.customerId,
          type: 'RETURN_REVERSAL',
          points: sale.loyaltyPointsEarned,
          refType: 'SaleVoid',
          refId: sale.id,
          userId: user.sub,
          note: 'Sotuv bekor qilindi',
        });
      }

      // Give back any points the customer spent on this sale — voiding it
      // means they never actually got the discount's value delivered.
      if (sale.loyaltyPointsRedeemed > 0 && sale.customerId) {
        await this.loyaltyService.write(tx, {
          customerId: sale.customerId,
          type: 'ADJUSTMENT',
          points: sale.loyaltyPointsRedeemed,
          refType: 'SaleVoid',
          refId: sale.id,
          userId: user.sub,
          note: 'Sotuv bekor qilindi — ishlatilgan ball qaytarildi',
        });
      }

      const voided = await tx.sale.update({
        where: { id: sale.id },
        data: { status: 'VOIDED', voidedAt: new Date() },
        include: SALE_INCLUDE,
      });

      await this.auditService.write(tx, {
        action: 'Sotuv bekor qilindi',
        entity: 'Sale',
        entityId: sale.id,
        detail: { code: sale.code, total: sale.total.toString() },
        userId: user.sub,
      });

      return voided;
    });
  }

  private async resolveLines(tx: TxClient, lines: CreateSaleDto['lines']) {
    const resolved = [];
    for (const line of lines) {
      const product = await tx.product.findUnique({
        where: { id: line.productId },
      });
      if (!product)
        throw new BadRequestException(`Tovar topilmadi: ${line.productId}`);
      const unit = await tx.productUnit.findUnique({
        where: {
          productId_label: { productId: line.productId, label: line.unitLabel },
        },
      });
      if (!unit)
        throw new BadRequestException(
          `"${line.unitLabel}" birligi shu tovar uchun topilmadi`,
        );

      const qtyInUnit = new Prisma.Decimal(line.qtyInUnit);
      const qtyBase = qtyInUnit.times(unit.factor);
      const unitPrice =
        line.unitPrice !== undefined
          ? new Prisma.Decimal(line.unitPrice)
          : unit.price;
      // Standing discount is set by an admin on the product itself, not by
      // the cashier per sale — see ProductUnit.discountAmount. It's a flat
      // sum off THIS unit's price, clamped so the effective price never
      // goes negative (e.g. if the price was lowered after the discount
      // was configured).
      const effectiveUnitPrice = Prisma.Decimal.max(
        0,
        unitPrice.minus(unit.discountAmount),
      );
      const unitDiscountAmount = unitPrice.minus(effectiveUnitPrice);
      const lineTotal = qtyInUnit.times(effectiveUnitPrice);

      resolved.push({
        productId: line.productId,
        productName: product.name,
        unitLabel: unit.label,
        unitFactor: unit.factor,
        qtyInUnit,
        qtyBase,
        unitPrice,
        unitDiscountAmount,
        lineTotal,
      });
    }
    return resolved;
  }

  // CASH is the only tender that can produce change: non-cash tenders (CARD/
  // CLICK/CREDIT) cover the total first, and any cash beyond what's left
  // owed is handed back. paidAmount is capped at total so it never overstates
  // what was actually applied to the sale. See plan.md "To'lov".
  private settleTenders(tenders: CreateSaleTenderDto[], total: Prisma.Decimal) {
    const cashTotal = tenders
      .filter((t) => t.type === 'CASH')
      .reduce((acc, t) => acc.plus(t.amount), new Prisma.Decimal(0));
    const nonCashTotal = tenders
      .filter((t) => t.type !== 'CASH')
      .reduce((acc, t) => acc.plus(t.amount), new Prisma.Decimal(0));
    const owedForCash = Prisma.Decimal.max(0, total.minus(nonCashTotal));
    const changeAmount = Prisma.Decimal.max(0, cashTotal.minus(owedForCash));
    const paidAmount = Prisma.Decimal.min(
      total,
      cashTotal.plus(nonCashTotal).minus(changeAmount),
    );
    return { paidAmount, changeAmount };
  }

  private async nextCode(tx: TxClient): Promise<string> {
    const [{ nextval }] = await tx.$queryRaw<
      { nextval: bigint }[]
    >`SELECT nextval('sale_code_seq')`;
    return `#${nextval.toString()}`;
  }
}
