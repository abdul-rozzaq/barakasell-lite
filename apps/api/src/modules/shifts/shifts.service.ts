import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { OpenShiftDto } from './dto/open-shift.dto.js';
import { CloseShiftDto } from './dto/close-shift.dto.js';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto.js';

type TxClient = Prisma.TransactionClient;

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  findAll() {
    return this.prisma.shift.findMany({
      include: { openedBy: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const shift = await this.prisma.shift.findUnique({
      where: { id },
      include: {
        openedBy: { select: { name: true } },
        cashMoves: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!shift) throw new NotFoundException('Smena topilmadi');
    return shift;
  }

  async current(userId: string) {
    const shift = await this.findOpenShift(userId);
    if (!shift) return null;
    const expectedCash = await this.computeExpectedCash(
      this.prisma,
      shift.id,
      shift.openingCash,
    );
    return { ...shift, expectedCash };
  }

  // Non-throwing lookup for callers that treat "no open shift" as a valid
  // state (e.g. an admin recording a customer payment outside any shift).
  findOpenShift(userId: string) {
    return this.prisma.shift.findFirst({
      where: { openedById: userId, status: 'OPEN' },
      orderBy: { openedAt: 'desc' },
    });
  }

  // Used by SalesService/ReturnsService: a sale/return always books against
  // the caller's own open shift, never one supplied in the request body.
  async requireOpenShift(userId: string) {
    const shift = await this.findOpenShift(userId);
    if (!shift) {
      throw new ConflictException('Avval smena ochilishi kerak');
    }
    return shift;
  }

  async open(dto: OpenShiftDto, userId: string) {
    const existing = await this.prisma.shift.findFirst({
      where: { openedById: userId, status: 'OPEN' },
    });
    if (existing) {
      throw new ConflictException('Sizda ochiq smena bor');
    }
    return this.prisma.shift.create({
      data: {
        openedById: userId,
        openingCash: new Prisma.Decimal(dto.openingCash),
      },
    });
  }

  async addCashMovement(
    shiftId: string,
    dto: CreateCashMovementDto,
    user: AuthUser,
  ) {
    const shift = await this.assertOpen(shiftId);
    this.assertOwner(shift, user);

    return this.prisma.$transaction(async (tx) => {
      const movement = await tx.cashMovement.create({
        data: {
          shiftId,
          type: dto.type,
          amount: new Prisma.Decimal(dto.amount),
          reason: dto.reason,
          userId: user.sub,
        },
      });

      await this.auditService.write(tx, {
        action: dto.type === 'IN' ? 'Kassaga kiritish' : 'Inkassatsiya',
        entity: 'CashMovement',
        entityId: movement.id,
        detail: { shiftId, amount: dto.amount, reason: dto.reason },
        userId: user.sub,
      });

      return movement;
    });
  }

  async close(shiftId: string, dto: CloseShiftDto, user: AuthUser) {
    const shift = await this.assertOpen(shiftId);
    this.assertOwner(shift, user);

    return this.prisma.$transaction(async (tx) => {
      const expectedCash = await this.computeExpectedCash(
        tx,
        shiftId,
        shift.openingCash,
      );
      const countedCash = new Prisma.Decimal(dto.countedCash);
      const diffCash = countedCash.minus(expectedCash);

      const closed = await tx.shift.update({
        where: { id: shiftId },
        data: {
          status: 'CLOSED',
          expectedCash,
          countedCash,
          diffCash,
          closedAt: new Date(),
        },
      });

      await this.auditService.write(tx, {
        action: 'Smena yopildi',
        entity: 'Shift',
        entityId: shiftId,
        detail: {
          expectedCash: expectedCash.toString(),
          countedCash: countedCash.toString(),
          diffCash: diffCash.toString(),
        },
        userId: user.sub,
      });

      return closed;
    });
  }

  // openingCash + cash sales - cash refunds + cash credit payments booked to
  // this shift + cash-in - cash-out. See plan.md "Smena".
  private async computeExpectedCash(
    tx: TxClient,
    shiftId: string,
    openingCash: Prisma.Decimal,
  ): Promise<Prisma.Decimal> {
    const [cashSales, cashReturns, cashPayments, movesIn, movesOut] =
      await Promise.all([
        tx.saleTender.aggregate({
          where: { type: 'CASH', sale: { shiftId, status: 'COMPLETED' } },
          _sum: { amount: true },
        }),
        tx.saleReturn.aggregate({
          where: { shiftId, refundTender: 'CASH' },
          _sum: { refundTotal: true },
        }),
        tx.customerDebtEntry.aggregate({
          where: {
            type: 'PAYMENT',
            tender: 'CASH',
            refType: 'Shift',
            refId: shiftId,
          },
          _sum: { amount: true },
        }),
        tx.cashMovement.aggregate({
          where: { shiftId, type: 'IN' },
          _sum: { amount: true },
        }),
        tx.cashMovement.aggregate({
          where: { shiftId, type: 'OUT' },
          _sum: { amount: true },
        }),
      ]);

    // CustomerDebtEntry.amount is signed by its effect on the DEBT balance
    // (CustomerDebtService negates PAYMENT), so the cash actually received is
    // the negation of that stored sum — hence minus, not plus, here.
    return openingCash
      .plus(cashSales._sum.amount ?? 0)
      .minus(cashReturns._sum.refundTotal ?? 0)
      .minus(cashPayments._sum.amount ?? 0)
      .plus(movesIn._sum.amount ?? 0)
      .minus(movesOut._sum.amount ?? 0);
  }

  private async assertOpen(id: string) {
    const shift = await this.findOne(id);
    if (shift.status !== 'OPEN') {
      throw new ConflictException('Smena allaqachon yopilgan');
    }
    return shift;
  }

  private assertOwner(shift: { openedById: string }, user: AuthUser) {
    if (user.role !== 'ADMIN' && shift.openedById !== user.sub) {
      throw new ForbiddenException('Bu smena sizga tegishli emas');
    }
  }
}
