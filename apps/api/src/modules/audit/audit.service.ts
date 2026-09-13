import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Prisma } from '../../generated/prisma/client.js';

export interface WriteAuditInput {
  action: string;
  entity: string;
  entityId?: string;
  detail: Prisma.InputJsonValue;
  userId?: string;
  ip?: string;
}

type TxClient = Prisma.TransactionClient;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  findAll(filter: { action?: string; userId?: string; from?: Date; to?: Date }) {
    return this.prisma.auditLog.findMany({
      where: {
        action: filter.action,
        userId: filter.userId,
        createdAt:
          filter.from || filter.to
            ? { gte: filter.from, lte: filter.to }
            : undefined,
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // Fire-and-forget outside a business transaction: an audit failure must
  // never roll back the operation it is describing.
  writeAsync(input: WriteAuditInput) {
    this.prisma.auditLog
      .create({
        data: {
          action: input.action,
          entity: input.entity,
          entityId: input.entityId,
          detail: input.detail,
          userId: input.userId,
          ip: input.ip,
        },
      })
      .catch((err) => this.logger.error(`audit write failed: ${err}`));
  }

  // Same-transaction write for events that occur inside a posting transaction
  // (receipt post, inventory count post, sale void) and must be atomic with it.
  async write(tx: TxClient, input: WriteAuditInput) {
    await tx.auditLog.create({
      data: {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        detail: input.detail,
        userId: input.userId,
        ip: input.ip,
      },
    });
  }
}
