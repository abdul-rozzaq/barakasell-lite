import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { CustomersService } from '../customers/customers.service.js';
import { LoyaltyService } from '../loyalty/loyalty.service.js';
import { ProductsService, type StockFilter } from '../catalog/products.service.js';
import { ReportsService } from '../reports/reports.service.js';
import { OwnerLinkService } from '../owner-link/owner-link.service.js';
import { WaitlistService } from '../waitlist/waitlist.service.js';

// Plain interfaces, not class-validator DTOs — the Telegram bot now calls
// this service directly, in-process, so there's no HTTP body to validate.
export interface RegisterCustomerInput {
  telegramId: string;
  phone: string;
  name: string;
  telegramUsername?: string;
}

export interface CreateWaitlistInput {
  productId?: string;
  rawText?: string;
}

@Injectable()
export class BotService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly customersService: CustomersService,
    private readonly loyaltyService: LoyaltyService,
    private readonly productsService: ProductsService,
    private readonly reportsService: ReportsService,
    private readonly ownerLinkService: OwnerLinkService,
    private readonly waitlistService: WaitlistService,
  ) {}

  // Idempotent: re-registering the same Telegram account (e.g. re-running
  // /start) just returns the existing customer instead of erroring or
  // creating a duplicate. Links onto an existing phone-matched customer
  // (e.g. one already in the debt ledger from an in-store credit sale)
  // rather than always creating a fresh one.
  async register(dto: RegisterCustomerInput) {
    const telegramId = BigInt(dto.telegramId);

    const existingByTelegram = await this.prisma.customer.findUnique({ where: { telegramId } });
    if (existingByTelegram) {
      return this.loyaltyService.ensureCard(existingByTelegram.id);
    }

    const existingByPhone = await this.customersService.findByPhone(dto.phone);
    const customer = existingByPhone
      ? await this.prisma.customer.update({
          where: { id: existingByPhone.id },
          data: { telegramId, telegramUsername: dto.telegramUsername },
        })
      : await this.prisma.customer.create({
          data: { name: dto.name, phone: dto.phone, telegramId, telegramUsername: dto.telegramUsername },
        });

    return this.loyaltyService.ensureCard(customer.id);
  }

  findByTelegramId(telegramId: string) {
    return this.prisma.customer.findUnique({ where: { telegramId: BigInt(telegramId) } });
  }

  async loyalty(customerId: string) {
    const customer = await this.customersService.findOne(customerId);
    const entries = await this.loyaltyService.history(customerId);
    return { pointsBalance: customer.pointsBalance, cardCode: customer.cardCode, entries };
  }

  async debt(customerId: string) {
    const customer = await this.customersService.findOne(customerId);
    return { debtBalance: customer.debtBalance, entries: customer.entries };
  }

  purchases(customerId: string, limit = 20) {
    return this.prisma.sale.findMany({
      where: { customerId, status: 'COMPLETED' },
      orderBy: { soldAt: 'desc' },
      take: Math.min(limit, 100),
      select: { id: true, code: true, soldAt: true, total: true, loyaltyPointsEarned: true },
    });
  }

  // --- Owner linking (admin panel "Telegram'ga ulash") -----------------

  async linkOwner(code: string, telegramId: string) {
    const userId = this.ownerLinkService.consume(code);
    if (!userId) {
      throw new BadRequestException("Kod noto'g'ri yoki muddati o'tgan");
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { telegramId: BigInt(telegramId) },
      select: { id: true, name: true, role: true },
    });
  }

  findOwnerByTelegramId(telegramId: string) {
    return this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      select: { id: true, name: true, role: true },
    });
  }

  // --- AI agent read tools (see apps/bot/src/agent) ---------------------

  async searchProducts(q?: string, stockFilter?: StockFilter) {
    const result = await this.productsService.findAll({ q, stockFilter, take: 20 });
    return result.items.map((p) => {
      const baseUnit = p.units.find((u) => u.isBase) ?? p.units[0];
      return {
        id: p.id,
        name: p.name,
        sku: p.sku,
        unitLabel: p.baseUnitLabel,
        price: baseUnit?.price ?? null,
        stock: p.stock,
        inStock: p.stock.gt(0),
      };
    });
  }

  lowStock() {
    return this.searchProducts(undefined, 'low');
  }

  outOfStock() {
    return this.searchProducts(undefined, 'out');
  }

  salesSummary(from?: Date, to?: Date) {
    if (!from && !to) return this.reportsService.dashboard();
    return this.reportsService.profitReport({ from, to, groupBy: 'period' });
  }

  async topProducts() {
    const dashboard = await this.reportsService.dashboard();
    return dashboard.topProducts;
  }

  deadStock(days: number) {
    return this.reportsService.deadStock(days);
  }

  profit(groupBy: 'period' | 'product' | 'category', from?: Date, to?: Date) {
    return this.reportsService.profitReport({ from, to, groupBy });
  }

  openShifts() {
    return this.prisma.shift.findMany({
      where: { status: 'OPEN' },
      include: { openedBy: { select: { name: true } } },
      orderBy: { openedAt: 'desc' },
    });
  }

  demand(days: number) {
    return this.reportsService.demand(days);
  }

  // --- Waitlist (customer "let me know when it's back") -----------------

  createWaitlistEntry(customerId: string, dto: CreateWaitlistInput) {
    return this.waitlistService.create({
      customerId,
      productId: dto.productId,
      rawText: dto.rawText,
      source: 'BOT',
    });
  }

  // --- Notification outbox (polled by apps/bot) --------------------------

  listOutbox(limit = 50) {
    return this.prisma.notificationOutbox.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 200),
    });
  }

  async ackOutbox(id: string, result: 'sent' | 'failed', error?: string) {
    const row = await this.prisma.notificationOutbox.findUnique({ where: { id } });
    if (!row) throw new NotFoundException("Outbox yozuvi topilmadi");

    if (result === 'sent') {
      return this.prisma.notificationOutbox.update({
        where: { id },
        data: { status: 'SENT', sentAt: new Date() },
      });
    }

    const attempts = row.attempts + 1;
    return this.prisma.notificationOutbox.update({
      where: { id },
      data: {
        attempts,
        lastError: error,
        status: attempts >= 3 ? 'FAILED' : 'PENDING',
      },
    });
  }
}
