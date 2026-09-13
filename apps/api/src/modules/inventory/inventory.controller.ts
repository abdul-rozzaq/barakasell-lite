import { Controller, Get, Post, Query } from '@nestjs/common';
import { StockService } from './stock.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RequiresPinConfirmation } from '../../common/decorators/requires-pin.decorator.js';
import { Audit } from '../../common/decorators/audit.decorator.js';
import { UserRole, type LedgerType } from '../../generated/prisma/client.js';

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly stockService: StockService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('stock')
  async stockValue() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, stock: true, avgCost: true },
      orderBy: { name: 'asc' },
    });
    return products.map((p) => ({
      ...p,
      stockValue: p.stock.times(p.avgCost),
    }));
  }

  @Get('ledger')
  ledger(
    @Query('productId') productId?: string,
    @Query('type') type?: LedgerType,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.stockService.listLedger({
      productId,
      type,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      cursor,
    });
  }

  @Get('verify')
  @Roles(UserRole.ADMIN)
  verify() {
    return this.stockService.verify();
  }

  @Post('verify/repair')
  @Roles(UserRole.ADMIN)
  @RequiresPinConfirmation()
  @Audit({ action: 'Zaxira tuzatildi', entity: 'Inventory' })
  repair() {
    return this.stockService.repair();
  }
}
