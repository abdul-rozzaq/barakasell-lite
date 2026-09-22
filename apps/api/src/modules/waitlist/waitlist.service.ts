import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, type ProductRequestSource } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface CreateProductRequestInput {
  customerId?: string;
  productId?: string;
  rawText?: string;
  phone?: string;
  source: ProductRequestSource;
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateProductRequestInput) {
    if (!input.productId && !input.rawText) {
      throw new BadRequestException("Tovar ID yoki tovar nomi ko'rsatilishi kerak");
    }
    return this.prisma.productRequest.create({ data: input });
  }

  // Called from ReceiptsService.post() inside the SAME transaction: any
  // OPEN request against one of the receipt's products is resolved. A
  // request only gets an outbox row (i.e. an actual Telegram message) when
  // its customer has a linked telegramId — there is no other delivery
  // channel yet. Requests with no linkable customer (a raw phone-only POS
  // entry, or a customer who never opened the bot) are still marked
  // NOTIFIED so the demand report doesn't keep counting them as open.
  async notifyArrivals(tx: TxClient, productIds: string[], receiptId: string) {
    if (productIds.length === 0) return;

    const requests = await tx.productRequest.findMany({
      where: { status: 'OPEN', productId: { in: productIds } },
      include: { customer: true, product: { select: { name: true } } },
    });
    if (requests.length === 0) return;

    for (const request of requests) {
      if (request.customer?.telegramId) {
        await tx.notificationOutbox.create({
          data: {
            kind: 'product_arrived',
            payload: {
              requestId: request.id,
              receiptId,
              productId: request.productId,
              productName: request.product?.name ?? request.rawText,
            },
            targetType: 'CUSTOMER',
            targetTelegramId: request.customer.telegramId,
          },
        });
      }
      await tx.productRequest.update({
        where: { id: request.id },
        data: { status: 'NOTIFIED', notifiedAt: new Date() },
      });
    }
  }
}
