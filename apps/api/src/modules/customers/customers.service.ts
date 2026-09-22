import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CustomerDebtService } from './customer-debt.service.js';
import { ShiftsService } from '../shifts/shifts.service.js';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { CreateCustomerDto } from './dto/create-customer.dto.js';
import { UpdateCustomerDto } from './dto/update-customer.dto.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customerDebtService: CustomerDebtService,
    private readonly shiftsService: ShiftsService,
  ) {}

  findAll(q?: string) {
    return this.prisma.customer.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : undefined,
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async findOne(id: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id },
      include: { entries: { orderBy: { seq: 'desc' }, take: 50 } },
    });
    if (!customer) throw new NotFoundException('Mijoz topilmadi');
    return customer;
  }

  async findByCardCode(cardCode: string) {
    const customer = await this.prisma.customer.findUnique({ where: { cardCode } });
    if (!customer) throw new NotFoundException('Karta topilmadi');
    return customer;
  }

  findByPhone(phone: string) {
    return this.prisma.customer.findFirst({ where: { phone } });
  }

  listEntries(id: string, cursor?: string, take = 50) {
    return this.prisma.customerDebtEntry.findMany({
      where: { customerId: id },
      orderBy: { seq: 'desc' },
      take: Math.min(take, 200),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  create(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: dto });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.findOne(id);
    return this.prisma.customer.update({ where: { id }, data: dto });
  }

  async addPayment(id: string, dto: CreatePaymentDto, user: AuthUser) {
    await this.findOne(id);
    const shift =
      dto.tender === 'CASH'
        ? await this.shiftsService.findOpenShift(user.sub)
        : null;

    return this.prisma.$transaction((tx) =>
      this.customerDebtService.write(tx, {
        customerId: id,
        type: 'PAYMENT',
        amount: new Prisma.Decimal(dto.amount),
        tender: dto.tender,
        refType: shift ? 'Shift' : undefined,
        refId: shift ? shift.id : undefined,
        userId: user.sub,
        note: dto.note,
      }),
    );
  }
}
