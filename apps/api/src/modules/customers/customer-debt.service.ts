import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type DebtEntryType,
  type TenderType,
} from '../../generated/prisma/client.js';

export interface WriteDebtEntryInput {
  customerId: string;
  type: DebtEntryType;
  // CREDIT_SALE / PAYMENT / RETURN_CREDIT: positive magnitude, sign is
  // applied internally below. ADJUSTMENT: caller supplies the signed delta
  // directly (a manual correction can go either way).
  amount: Prisma.Decimal | number | string;
  refType?: string;
  refId?: string;
  tender?: TenderType;
  userId: string;
  note?: string;
}

type TxClient = Prisma.TransactionClient;

// The ONLY place Customer.debtBalance is written — the debt-side twin of
// StockService. CustomerDebtEntry.balanceAfter mirrors StockLedgerEntry's
// cumulative-snapshot pattern. See plan.md "Nasiya".
@Injectable()
export class CustomerDebtService {
  async write(tx: TxClient, input: WriteDebtEntryInput) {
    await tx.$queryRaw`SELECT id FROM "Customer" WHERE id = ${input.customerId} FOR UPDATE`;
    const customer = await tx.customer.findUniqueOrThrow({
      where: { id: input.customerId },
    });

    const magnitude = new Prisma.Decimal(input.amount);
    const signedAmount =
      input.type === 'PAYMENT' || input.type === 'RETURN_CREDIT'
        ? magnitude.negated()
        : magnitude;
    const balanceAfter = customer.debtBalance.plus(signedAmount);

    const entry = await tx.customerDebtEntry.create({
      data: {
        customerId: input.customerId,
        type: input.type,
        amount: signedAmount,
        balanceAfter,
        refType: input.refType,
        refId: input.refId,
        tender: input.tender,
        userId: input.userId,
        note: input.note,
      },
    });

    await tx.customer.update({
      where: { id: input.customerId },
      data: { debtBalance: balanceAfter },
    });

    return entry;
  }
}
