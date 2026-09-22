import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type LoyaltyEntryType } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { generateLoyaltyCardCode } from './loyalty-card.util.js';

export interface WriteLoyaltyEntryInput {
  customerId: string;
  type: LoyaltyEntryType;
  // EARN/REDEEM/RETURN_REVERSAL: positive magnitude, sign is applied
  // internally below (REDEEM/RETURN_REVERSAL subtract from the balance).
  // ADJUSTMENT: caller supplies the signed delta directly.
  points: number;
  refType?: string;
  refId?: string;
  userId?: string;
  note?: string;
}

type TxClient = Prisma.TransactionClient;

// The ONLY place Customer.pointsBalance is written — the loyalty-side twin
// of CustomerDebtService. LoyaltyEntry.balanceAfter mirrors
// CustomerDebtEntry's cumulative-snapshot pattern.
@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async write(tx: TxClient, input: WriteLoyaltyEntryInput) {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${input.customerId} FOR UPDATE`;
    const customer = await tx.customer.findUniqueOrThrow({
      where: { id: input.customerId },
    });

    const signedPoints =
      input.type === 'REDEEM' || input.type === 'RETURN_REVERSAL'
        ? -Math.abs(input.points)
        : input.points;
    const balanceAfter = customer.pointsBalance + signedPoints;

    const entry = await tx.loyaltyEntry.create({
      data: {
        customerId: input.customerId,
        type: input.type,
        points: signedPoints,
        balanceAfter,
        refType: input.refType,
        refId: input.refId,
        userId: input.userId,
        note: input.note,
      },
    });

    await tx.customer.update({
      where: { id: input.customerId },
      data: { pointsBalance: balanceAfter },
    });

    return entry;
  }

  async ensureCard(customerId: string) {
    const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    if (customer.cardCode) return customer;

    for (let attempt = 0; attempt < 5; attempt++) {
      const cardCode = generateLoyaltyCardCode();
      try {
        return await this.prisma.customer.update({
          where: { id: customerId },
          data: { cardCode },
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
      }
    }
    throw new ConflictException(
      "Karta kodi generatsiya qilinmadi, qayta urinib ko'ring",
    );
  }

  findByCardCode(cardCode: string) {
    return this.prisma.customer.findUnique({ where: { cardCode } });
  }

  history(customerId: string, limit = 50) {
    return this.prisma.loyaltyEntry.findMany({
      where: { customerId },
      orderBy: { seq: 'desc' },
      take: Math.min(limit, 200),
    });
  }
}
